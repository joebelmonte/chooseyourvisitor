# Choose your visitor

## By Joe Belmonte

Production deployed here: [Choose Your Visitor](https://joebelmonte.site/chooseyourvisitor.html)

Dev version deployed here: [Choose Your Visitor Dev](https://joebelmonte.site/dev/cyv/chooseyourvisitor.html)

## Release Notes

### March 26, 2022

- Added a button to allow the visitor to pause/unpause a session.
  - The visitor can optionally provide a message to be displayed to the agent.
- If the page is refreshed during a paused session, the session will resume in a paused state.
  - This is accomplished by adding the `data-startpaused="1"` attribute to the script tag.
- New sessions will always start in an unpaused state.

### March 15, 2022

- Refactored how the role-based masking demo works.
  - No longer accepts a comma delimited list of roles for the purposes of masking the entire page.
  - There are two sections, labeled `Agent Role "Test1" Content` and `Agent Role "Test2" Content`, that will be masked unless the agents viewing the session are in roles named `role1` and `role2`, respectively.
  - Agents in neither of those roles won't be able to see content in either section.
  - If agents in more than 1 role are viewing the session, both sections will be masked.

### January 29, 2022

- Added an option to set presence to`api` or `off` in the script tag in addition to `on`.
- Changed the label from `Settings` to `Data-Site`.
- Fixed a bug where the script tag was being added twice when `Auto load script` was enabled.

### January 17, 2022

- Added an option to connect to `myglance.net` in addition to `beta.glance.net` and `www.glance.net`.

### January 16, 2022

- Added a checkbox setting for `Auto load script`. If checked, the script will automatically load based on the existing configurations without the user having to click the `Submit` button.

### November 22, 2021

- Once the Cobrowse script has loaded, the version number will appear on the page below the `Title` and to the right of the `About` link.
