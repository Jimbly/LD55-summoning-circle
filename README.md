LD55 - Summoning
============================

Ludum Dare 55 Entry by Jimbly - "Summoning Circle Specialist"

* Play here: [dashingstrike.com/LudumDare/LD55/](http://www.dashingstrike.com/LudumDare/LD55/)
* Using [Javascript libGlov/GLOV.js framework](https://github.com/Jimbly/glovjs)

Acknowledgements:
* [GochiHand](https://fonts.google.com/specimen/Gochi+Hand) font
* [KHScala](https://www.dafont.com/khscala.font) font

Start with: `npm start` (after running `npm i` once)

TODO:
* Probably: need some way to be viewing sym and power at the same time
  * sym by colors (green/cyan)
  * power by pulses (pink?) running along it, with runes only showing up during pulse
  * maybe visibility toggles for sym/power?
* better demon heads
* SFX
* Music
* SFX/Music toggles
* zen mode toggle
* show one-line summary for each of the 4 modes when hovering over them; also allow hovering over the quadrant of the graph
* Change level 10 notification to use overlay screen
* Copy circle from previous if no save?  Start completely fresh beyond the first one?  Something more interesting as default?
* Do X through Power to indicate deleting, not red circle
* Highlight all lines and power red when highlighting a circle that would be deleted
* hover/etc is pretty crappy on mobile (post-jam fix?)
* fade runes

Polish / Bugs:
* Remove short line when drawing a larger line directly over it
* Remove short line when a power node completely consumes it
* Noisy BG grain texture
* portrait mode display
