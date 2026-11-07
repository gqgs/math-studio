# Agent instructions

## Workspace layout and screen space

Math Studio is a working tool, not a landing page. The global navigation already identifies the active tab.

- Start each tab directly with its interactive workspace (editor, controls, plot, or canvas), immediately below the shared site header.
- Do not introduce an in-tab hero, banner, eyebrow, marketing title, descriptive preamble, or duplicate of the tab name. Avoid tall top padding or margins that push useful controls below the fold.
- Keep compact panel headings and accessible names when they identify specific tools. Put substantive explanations in contextual help, the syntax guide, or README instead of a full-width introduction.
- Preserve a consistent layout across tabs and check both desktop and narrow mobile viewports when changing workspace structure.
- For layout changes, add or update a Playwright assertion guarding against unnecessary headers, excess space above the first panel, and horizontal overflow where relevant.
