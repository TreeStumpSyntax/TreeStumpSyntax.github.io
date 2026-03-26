# TODO

## High Priority

- Add a warning message to save before you exit a project or load a new one
- Add support for arrows - and look into other more advanced tree drawing techniques
- Add LaTeX rendering support

## Medium Priority

- Ensure triangles and terminal nodes have the same height
- Fix gaps between edges/lines when nodes have more than 2 children
- Consider solutions for easy ways to delete only 'V' in '[VP [V [NP ]]]' leaving only '[VP [NP ]]' instead of '[VP ]' - this would be an optional case though because you may still want to delete both the V and NP
- Consider how parts of the SVG are saved (how they are grouped, what is editable, etc)
- When you're in editing mode but you hover the text while holding cmd, it should show the finger pointer cursor instead of the typing cursor
- Drag should be disabled when auto-fit is on (and maybe zoom too) (idk about this one actually)
- Add color picker
- Ability to create new nodes while in interactive node edit mode
- Ability to move node position left/right in interactive node edit mode
- Ability to traverse nodes with arrow keys in interactive node edit mode so you don't have to move your hand to your mouse
- Interactive node creation (could be very useful - another use case for this would be starting a tree without touching the text editor)
- When highlighting text in interactive mode, it should highlight it in the edit panel too (and vice versa?)

## Low Priority

- Make logo and branding
- Consider updating fonts and overall aesthetics
- Make it obvious that there is more text if there are more than three lines / text below/above what is visible
- Add support for multiple trees side by side (maybe) (ex: [CP [C' ...]] [CP [C' ...]])
- Move the x button on the settings menu to the same spot as the hamburger button, so you don't need to move your mouse to close/open the settings
