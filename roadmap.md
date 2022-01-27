## high priority
- Star a folder which makes it also show up at the top of that folder (shows in starred, and in non-starred, below)
- Save the scroll height of each folder you visit
- Show what folder you're in
- Use svelte as a front-end lib instead of my hand-rolled garbage

## medium priority
- Show the video duration. No need to show folder duration. Those would be depressing
- Complete keyboard navigation

## icon (low priority)

- Better icon
- Use windows built-in icons??? https://www.electronjs.org/docs/api/app#appgetfileiconpath-options
- Improve icon handling:
	- https://www.electronjs.org/docs/api/browser-window#new-browserwindowoptions (ctrl+f "icon")
	- https://www.electronjs.org/docs/api/native-image


## don't immediately mark as watched (low priority)

- Make my own video player inside the application
	- If a video is half-played, then re-start the video where it was left off
	- Fullscreen mode
	- If 90% played then mark as fully played? (Or if they click the >| button)
	- If I do this, I should maybe find a decent simple video player that already exists, and hoist that
	- There should be an option to use an external video player? Or to "Explore to this folder" which opens Windows Explorer
- **OR**
- Make a timer on the modal, and only mark a video as "watched" if it has been playing for >50% of the video duration
