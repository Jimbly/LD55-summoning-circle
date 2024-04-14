LD55 - Summoning
============================

Ludum Dare 55 Entry by Jimbly - "Title TBD"

* Play here: [dashingstrike.com/LudumDare/LD55/](http://www.dashingstrike.com/LudumDare/LD55/)
* Using [Javascript libGlov/GLOV.js framework](https://github.com/Jimbly/glovjs)

Acknowledgements:
* [GochiHand](https://fonts.google.com/specimen/Gochi+Hand) font
* [KHScala](https://www.dafont.com/khscala.font) font

Start with: `npm start` (after running `npm i` once)

TODO:
* split intro separate from help - both shorter; F11 hint in intro
* Probably: need some way to be viewing sym and power at the same time
  * sym by colors (red/white)
  * power by pulses (green?) running along it, with runes only showing up during pulse
  * maybe visibility toggles for sym/power?
* better demon heads
* SFX
* Music
* SFX/Music toggles
* zen mode toggle
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
