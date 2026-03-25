# TODO

## High Priority

- Add tutorial page with videos
- Add color picker
- Update home page
- Interactive node creation (could be very useful - another use case for this would be starting a tree without touching the text editor)
- Ability to create new nodes while in interactive node edit mode
- Ability to move node position left/right in interactive node edit mode
- Ability to traverse nodes with arrow keys in interactive node edit mode so you don't have to move your hand to your mouse
- Add button to auto-centerd and zoom the view to fit the entire tree (add a button for a one-time fit and a button for a continual update mode) - also a mode that zooms in / follows the branch (/current leaf) of the tree that is currently being edited
- SEO
- Drag should be disabled when auto-fit is on (and maybe zoom too) (idk about this one actually)

## Medium Priority

- Add a warning message to save before you exit a project or load a new one
- Ensure triangles and terminal nodes have the same height
- Fix gaps between edges/lines when nodes have more than 2 children
- Consider solutions for easy ways to delete only 'V' in '[VP [V [NP ]]]' leaving only '[VP [NP ]]' instead of '[VP ]' - this would be an optional case though because you may still want to delete both the V and NP
- Add support for arrows - and look into other more advanced tree drawing techniques
- Add LaTeX rendering support
- Consider how parts of the SVG are saved (how they are grouped, what is editable, etc)
- When you're in editing mode but you hover the text while holding cmd, it should show the finger pointer cursor instead of the typing cursor

## Low Priority

- Consider updating fonts and overall aesthetics
- Make it obvious that there is more text if there are more than three lines / text below/above what is visible
- Add support for multiple trees side by side (maybe) (ex: [CP [C' ...]] [CP [C' ...]])
