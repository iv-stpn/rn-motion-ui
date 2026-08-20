---
'rn-motion-ui': patch
---

fix(MultiStepMenu): top-align the small-screen title and push it down with the back button

On small screens the rolling title sat a spacer row below the close button
when there was no back button, and stayed inline once one appeared. The title
now renders inline with the close button at the root, and moves below the
back-button row — animated down with the pane — once a section is pushed, so
the header reads consistently at every depth.
