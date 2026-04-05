# TODO

## High Priority

- Add a warning message to save before you exit a project or load a new one
- Add support for arrows - and look into other more advanced tree drawing techniques
- Add LaTeX rendering support
- Lots of visual glitches with the inline editing - mostly the cursor being above the text, and brackets overlapping with text and bracket highlighting glow being offset from brackets

## Medium Priority

- Ensure triangles and terminal nodes have the same height
- Fix gaps between edges/lines when nodes have more than 2 children
- Consider solutions for easy ways to delete only 'V' in '[VP [V [NP ]]]' leaving only '[VP [NP ]]' instead of '[VP ]' - this would be an optional case though because you may still want to delete both the V and NP
- Consider how parts of the SVG are saved (how they are grouped, what is editable, etc)
- When you're in editing mode but you hover the text while holding cmd, it should show the finger pointer cursor instead of the typing cursor
- Add color picker
- Ability to create new nodes while in interactive node edit mode
- Ability to move node position left/right in interactive node edit mode
- Ability to traverse nodes with arrow keys in interactive node edit mode so you don't have to move your hand to your mouse
- Interactive node creation (could be very useful - another use case for this would be starting a tree without touching the text editor)
- When highlighting text in interactive mode, it should highlight it in the edit panel too (and vice versa?)
- Make cmd +/- zoom in/out in interactive mode instead of page zoom in/out
- Add zoom level for auto-fit mode
- Camera drag should be disabled when auto-fit is on
- Remove leading and trailing whitespace in edit panel
- Spacing issues - edit panel sometimes goes over tree on autozoom mode - could be a issue with triangles idk
- when you export a project, and then import it, the project name doesn't match the file name it was exported with

## Low Priority

- Make logo and branding
- Consider updating fonts and overall aesthetics
- Make it obvious that there is more text if there are more than three lines / text below/above what is visible
- Add support for multiple trees side by side (maybe) (ex: [CP [C' ...]] [CP [C' ...]])
- Move the x button on the settings menu to the same spot as the hamburger button, so you don't need to move your mouse to close/open the settings
- Update things for mobile version
