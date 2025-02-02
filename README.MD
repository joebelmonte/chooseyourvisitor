# Choose your visitor

## By Joe Belmonte

Production deployed here: [Choose Your Visitor](https://www.glancedev1.com/joeb/cyv/chooseyourvisitor.html)

Dev version deployed here: [Choose Your Visitor Dev](https://www.glancedev1.com/joeb/dev/cyv/chooseyourvisitor.html)

## Release Notes

### February 2, 2024

- Added ability to specify a direct link to the loader file in the script tag

### November 5, 2024

- Added support for arbitrary website and cdn values
- Added `Reset` link which will re-load the page w/o any querystring parameters

### September 23, 2024

- Added session metrics as optional parameter for script tag.

### September 9, 2023

- The session key automatically gets copied to the clipboard on session start

### July 23, 2023

- Added support for specifying additional group IDs in the script tag

### July 3, 2023

- Removed styling for restricted editing elements from the visitor side
  - This styling is now handled on the agent side only, and only when restriced editing mode is enabled

### May 19, 2023

- Refactored code related to self-hosted script versions. Added back several versions as options.
- Included folder with those self-hosted script versions in the repo.

### May 15, 2023

- Moved deployment to glancedev1.com domain.
- Added `dw3` and `dw4` as website options.
- Added 6.3.1 as self-hosted script option.

### August 27, 2022

- Added `dw1` and `dw2` as website options.

### August 5, 2022

- Added `video on session start` as a configuration option
- Added buttons to start the session in large/small/off video mode using the api to override group default and script tag.

### July 6, 2022

- Removed inline styles and scripts

### June 20, 2022

- Added section for Restricted Editing demo

### June 5, 2022

- Added patch number to CB script version displayed at top of page.
- Added a data list to specify whether to use a self-hosted script or not.
  - Leave empty to pull the script from the Glance CDN.

### May 2, 2022

- Added a link to the page that opens a pop-up window.
  - The pop-up's URL is the same as the current window.
  - If "auto load script" is checked, the session should automatically continue to the pop-up.
- Refactored/added some event listeners that start with `GLANCE SESSION LISTENER:` for debugging purposes.

### April 8, 2022

- Added a button to dynamically change the visitor ID after page load.
  - Only available when using cobrowse version 5.4+.

### April 3, 2022

- Some enhancements/fixes regarding session pausing/unpausing.
  - The pausing APIs are only available on versions 5.1 or later of cobrowse, so the relevant portions of the code are now wrapped in if statements to make the page backwards compatible with older CB versions. Previously older CB versions crashed the page.
  - Added a `title` hover to the `Pause Session` button when it's disabled explaining why it's disabled.
  - No longer modifying the Glance UI when the session is paused. This was interfering/overwriting localization. There is now a session paused indicator at the top of the page on the visitor side.

### March 27, 2022

- Added an alternative session start button.
  - In addition to starting the session, this button checks to see if the Glance Visitor UI has been loaded. If not, it displays a custom spinner indicating to the visitor that the session is beginning. The spinner is hidden once the session starts.
  - This is meant to address the fact that the built-in Glance `Session Starting...` UI doesn't show up for the first session after page load.

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
