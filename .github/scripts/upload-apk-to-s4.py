#!/usr/bin/env python3
"""Upload an APK to MEGA S4 and print a presigned download URL.

Stdlib-only SigV4 client for the S3 API — no boto3 / aws-cli / rclone needed
on CI runners. Uses path-style addressing ({endpoint}/{bucket}/{key}), same as
the offkeep backend's aws4fetch usage.

MEGA S4 specifics handled here:
  * SigV4 credential scope region is ALWAYS us-east-1 (any endpoint works).
  * Presigned URLs max out at 7 days (604800s).
  * The signing region must be us-east-1 even when the endpoint is a different
    S4 region — a wrong scope yields 403 InvalidAccessKeyId.

Usage:
  upload-apk-to-s4.py --file PATH --key s3/key.apk
      --endpoint https://s3.eu-amsterdam.megas4.com
      --region us-east-1 --bucket offkeep-apks-staging
      --access-key ACCESS --secret-key SECRET
      [--expires 604800] [--prune-keep N]

On success prints ONLY the presigned GET URL to stdout (nothing else), so the
caller can capture it directly. Exits 1 on failure. With --prune-keep N,
best-effort deletes all but the N newest objects under the key's directory
prefix (failures are warnings, never fatal).
"""

import argparse
import hashlib
import hmac
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

SERVICE = "s3"
ALGO = "AWS4-HMAC-SHA256"


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hmac_sha256(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def signing_key(secret: str, date_stamp: str, region: str) -> bytes:
    k = hmac_sha256(("AWS4" + secret).encode("utf-8"), date_stamp)
    k = hmac_sha256(k, region)
    k = hmac_sha256(k, SERVICE)
    return hmac_sha256(k, "aws4_request")


def uri_encode(s: str, safe: str = "") -> str:
    return urllib.parse.quote(s, safe=safe)


def canonical_query(params: dict) -> str:
    """Sort + encode query params the way SigV4 demands (values as given)."""
    return "&".join(
        f"{uri_encode(k, '-_.~')}={uri_encode(str(v), '-_.~')}"
        for k, v in sorted(params.items())
    )


def s3_request(
    endpoint: str,
    bucket: str,
    key: str,
    access: str,
    secret: str,
    region: str,
    method: str,
    query_params: dict | None = None,
    body: bytes | None = None,
) -> tuple[int, bytes]:
    """Send a signed S3 request (path-style). Returns (status, body)."""
    host = urllib.parse.urlparse(endpoint).netloc
    path = "/" + bucket + "/" + uri_encode(key, "/")
    dt = datetime.now(timezone.utc)

    headers = {"host": host, "x-amz-date": dt.strftime("%Y%m%dT%H%M%SZ")}
    # MEGA S4 requires x-amz-content-sha256 on EVERY request, including
    # bodyless GET/DELETE (otherwise 400 MissingSecurityHeader) — verified
    # 2026-08-29. aws4fetch does the same for all S3 requests.
    payload_hash = "UNSIGNED-PAYLOAD"
    if body is not None:
        payload_hash = sha256_hex(body)
    headers["x-amz-content-sha256"] = payload_hash

    signed_headers = ";".join(sorted(headers))
    canonical_headers = "".join(f"{k}:{headers[k]}\n" for k in sorted(headers))
    qs = canonical_query(query_params or {})

    canonical_request = (
        f"{method}\n{path}\n{qs}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    )
    scope = f"{dt.strftime('%Y%m%d')}/{region}/{SERVICE}/aws4_request"
    string_to_sign = (
        f"{ALGO}\n{dt.strftime('%Y%m%dT%H%M%SZ')}\n{scope}\n{sha256_hex(canonical_request.encode('utf-8'))}"
    )
    signature = hmac.new(
        signing_key(secret, dt.strftime("%Y%m%d"), region),
        string_to_sign.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    auth = (
        f"{ALGO} Credential={access}/{scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )
    headers["Authorization"] = auth

    url = endpoint.rstrip("/") + path
    if qs:
        url += "?" + qs
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=600) as resp:
        return resp.status, resp.read()


def presign_get(
    endpoint: str,
    bucket: str,
    key: str,
    access: str,
    secret: str,
    region: str,
    expires: int,
) -> str:
    """Return a presigned GET URL valid for `expires` seconds."""
    host = urllib.parse.urlparse(endpoint).netloc
    path = "/" + bucket + "/" + uri_encode(key, "/")
    dt = datetime.now(timezone.utc)

    params = {
        "X-Amz-Algorithm": ALGO,
        "X-Amz-Credential": f"{access}/{dt.strftime('%Y%m%d')}/{region}/{SERVICE}/aws4_request",
        "X-Amz-Date": dt.strftime("%Y%m%dT%H%M%SZ"),
        "X-Amz-Expires": str(expires),
        "X-Amz-SignedHeaders": "host",
    }
    qs = canonical_query(params)
    # SigV4 canonical request: each canonical header line ends with '\n', and
    # the join adds another '\n' before the signed-headers line (empty line
    # between the two). MEGA S4 computes the canonical request this way — a
    # single '\n' there yields SignatureDoesNotMatch (verified 2026-08-29).
    canonical_request = f"GET\n{path}\n{qs}\nhost:{host}\n\nhost\nUNSIGNED-PAYLOAD"
    scope = f"{dt.strftime('%Y%m%d')}/{region}/{SERVICE}/aws4_request"
    string_to_sign = (
        f"{ALGO}\n{dt.strftime('%Y%m%dT%H%M%SZ')}\n{scope}\n{sha256_hex(canonical_request.encode('utf-8'))}"
    )
    signature = hmac.new(
        signing_key(secret, dt.strftime("%Y%m%d"), region),
        string_to_sign.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{endpoint.rstrip('/')}{path}?{qs}&X-Amz-Signature={signature}"


def list_keys(
    endpoint: str, bucket: str, prefix: str, access: str, secret: str, region: str
) -> list[tuple[str, str]]:
    """List (key, last_modified) under a prefix (ListObjectsV2, paginated)."""
    ns = {"s": "http://s3.amazonaws.com/doc/2006-03-01/"}
    out: list[tuple[str, str]] = []
    token = None
    while True:
        query = {"list-type": "2", "prefix": prefix}
        if token:
            query["continuation-token"] = token
        status, body = s3_request(
            endpoint, bucket, "", access, secret, region, "GET", query_params=query
        )
        if status != 200:
            raise RuntimeError(f"ListObjectsV2 failed with HTTP {status}: {body[:500]!r}")
        root = ET.fromstring(body)
        for contents in root.findall("s:Contents", ns):
            out.append(
                (
                    contents.findtext("s:Key", namespaces=ns) or "",
                    contents.findtext("s:LastModified", namespaces=ns) or "",
                )
            )
        if root.findtext("s:IsTruncated", namespaces=ns) == "true":
            token = root.findtext("s:NextContinuationToken", namespaces=ns)
        else:
            break
    return out


def prune_old(
    endpoint: str,
    bucket: str,
    prefix: str,
    access: str,
    secret: str,
    region: str,
    keep: int,
) -> None:
    """Delete all but the `keep` newest objects under prefix (best-effort)."""
    try:
        keys = list_keys(endpoint, bucket, prefix, access, secret, region)
    except Exception as exc:  # noqa: BLE001 — pruning must never fail the build
        print(f"warning: prune list failed, skipping: {exc}", file=sys.stderr)
        return
    keys.sort(key=lambda item: item[1], reverse=True)
    stale = [key for key, _ in keys[keep:]]
    for key in stale:
        try:
            status, _ = s3_request(
                endpoint, bucket, key, access, secret, region, "DELETE"
            )
            if status not in (200, 204):
                print(
                    f"warning: DELETE {key} returned HTTP {status}", file=sys.stderr
                )
        except Exception as exc:  # noqa: BLE001
            print(f"warning: failed to delete {key}: {exc}", file=sys.stderr)
    if stale:
        print(
            f"pruned {len(stale)} old object(s) under s3://{bucket}/{prefix}",
            file=sys.stderr,
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload an APK to MEGA S4")
    parser.add_argument("--file", required=True, help="Path to the APK file")
    parser.add_argument("--key", required=True, help="S3 object key (e.g. apks/staging/1/app.apk)")
    parser.add_argument("--endpoint", required=True, help="S4 endpoint URL")
    parser.add_argument("--region", required=True, help="SigV4 region (us-east-1 for S4)")
    parser.add_argument("--bucket", required=True, help="Bucket name")
    parser.add_argument("--access-key", required=True)
    parser.add_argument("--secret-key", required=True)
    parser.add_argument("--expires", type=int, default=604800, help="Presign TTL seconds (S4 max 604800)")
    parser.add_argument(
        "--prune-keep",
        type=int,
        default=0,
        help="Keep the N newest objects under --prune-prefix, delete older (0 = no pruning)",
    )
    parser.add_argument(
        "--prune-prefix",
        default=None,
        help="Object-key prefix to prune under (default: the uploaded key's directory, "
        "which only ever holds one object — pass e.g. apks/staging/ to prune across runs)",
    )
    args = parser.parse_args()

    try:
        with open(args.file, "rb") as fh:
            body = fh.read()
    except OSError as exc:
        print(f"error: cannot read {args.file}: {exc}", file=sys.stderr)
        return 1

    status, resp = s3_request(
        args.endpoint,
        args.bucket,
        args.key,
        args.access_key,
        args.secret_key,
        args.region,
        "PUT",
        body=body,
    )
    if status != 200:
        print(
            f"error: PUT s3://{args.bucket}/{args.key} failed with HTTP {status}: {resp[:500]!r}",
            file=sys.stderr,
        )
        return 1

    if args.prune_keep > 0:
        if args.prune_prefix is not None:
            prefix = args.prune_prefix
        else:
            prefix = args.key.rsplit("/", 1)[0] + "/" if "/" in args.key else ""
        prune_old(
            args.endpoint,
            args.bucket,
            prefix,
            args.access_key,
            args.secret_key,
            args.region,
            args.prune_keep,
        )

    url = presign_get(
        args.endpoint,
        args.bucket,
        args.key,
        args.access_key,
        args.secret_key,
        args.region,
        args.expires,
    )
    print(url)
    return 0


if __name__ == "__main__":
    sys.exit(main())
