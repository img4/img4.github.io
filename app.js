let userRepo = location.pathname.indexOf("C:") !== -1 ? 'img4/i' /* local dev */ : location.host.split('.')[0] + '/' + location.pathname.split('/')[1]
let id = (location.search ? location.search.substring(1) : '').split('&')[0]
let lastIndex, arInterval

$(() => {
	(async () => {
		// get lastIndex and poll regularly
		lastIndex = await getLastIndex()
		setInterval(() => {
			(async () => {
				let oldIndex = lastIndex
				lastIndex = await getLastIndex(true)
				// TODO when it increases, toast that there are new images
				if(lastIndex > oldIndex) {
					console.log('[poll] lastIndex > oldIndex = new images')
				}
			})()
		}, 5000)

		// on load, view one image or gallery
		if (id) { // one image
			console.log('init single image')
			// bind left and right keys to increase or decrease id
			document.addEventListener('keydown', (e) => {
				if (e.key === 'ArrowLeft') {
					clearInterval(arInterval)
					id = (parseInt(id, 36) - 1).toString(36)
					if (id < 1) id = 1
					history.replaceState(null, null, location.origin + location.pathname + '?' + id)
					initSingle(id)
				} else if (e.key === 'ArrowRight') {
					(async () => {
						let intId = parseInt(id, 36)
						console.log('ArrowRight intId:', intId, 'lastIndex:', lastIndex, intId >= lastIndex ? 'aborting' : '')
						if (intId >= lastIndex) return
						clearInterval(arInterval)
						id = (intId + 1).toString(36)
						history.replaceState(null, null, location.origin + location.pathname + '?' + id)
						initSingle(id)
					})()
				}
			});
			initSingle(id)
		} else { // gallery
			console.log('init gallery')
			// get latest image id from index
			$.get('https://raw.githubusercontent.com/' + userRepo + '/HEAD/index')
				.done(r => {
					console.log('r:', r)
				})
		}
	})()
})

async function getLastIndex(poll) {
	return new Promise(re => {
		let ls_lastIndex = localStorage.getItem('lastIndex')
		let ls_lastIndexTime = localStorage.getItem('lastIndexTime')
		if (Date.now() - parseInt(ls_lastIndexTime) <= 60000) {
			console.log((poll ? '[poll] ' : '') + 'getLastIndex() cached =', ls_lastIndex)
			return re(parseInt(ls_lastIndex))
		}
		$.get('https://api.github.com/repos/' + userRepo + '/commits?per_page=5', 'json')
			.done(r => {
				for (let i = 0; i < r.length; i++) {
					if (r[i].commit.message.match(/^Result /)) {
						let li = r[i].commit.message.split(' ')[1].toString()
						console.log((poll ? '[poll] ' : '') + 'getLastIndex() refreshed =', li)
						localStorage.setItem('lastIndex', li)
						localStorage.setItem('lastIndexTime', Date.now().toString())
						return re(parseInt(li))
					}
				}
			})
			.fail(err => {
				console.log('getLastIndex() failed, err:', err)
				let ls_lastIndex = localStorage.getItem('lastIndex')
				if (ls_lastIndex) {
					console.log('getLastIndex() failed, returning cached =', ls_lastIndex)
					return re(parseInt(ls_lastIndex))
				} else {
					console.log('getLastIndex() fatal error, no lastIndex in cache. returning null')
					return re(null)
				}
			})
	})
}

// begin display for a single image. show it or auto-refresh
function initSingle(id) {
	(async () => {
		console.log('initSingle(' + id + ')')
		let r, arStartTime, arWrap, refreshBtn
		r = await getImageData(id)
		if (r) showSingle(r)
		else {
			$('link[rel="icon"]').remove()
			$('title').text('Not found')
			console.log('image not found. start auto-refresh (id=' + id + ')')
			$('body').html('<div id="notfound"><b>Image ' + id + ' not found</b><br>New images can take a few seconds to propagate<br><div id="auto-refresh-wrap">Auto-refreshing every 3s for 5m...<br><div class="spinner-border text-primary" role="status" style="margin-top:5px"><span class="visually-hidden">Loading...</span></div></div><a id="refresh-btn" class="btn btn-primary" style="display:none; margin-top:5px" >Refresh</a><br></div>')
			arWrap = $('#auto-refresh-wrap')
			refreshBtn = $('#refresh-btn')

			let checkIt = function () {
				(async () => {
					console.log('checkIt(' + id + ')')
					if (Date.now() - arStartTime > 300000) {
						console.log('auto-refresh timeout, showing restart button')
						clearInterval(arInterval)
						arWrap.hide()
						refreshBtn.show()
					}
					r = await getImageData(id)
					if (r) {
						clearInterval(arInterval)
						showSingle(r)
					}
				})()
			}

			function autoRefreshStart(first) {
				console.log('autoRefreshStart(' + id + ')')
				refreshBtn.hide()
				arWrap.show()
				arStartTime = Date.now()
				if (arInterval) clearInterval(arInterval)
				arInterval = setInterval(checkIt, 3000)
				if (!first) checkIt()
			}

			autoRefreshStart(true)

			refreshBtn.click(function () {
				autoRefreshStart()
			})
		}
	})()
}

// show valid / found image
function showSingle(r) {
	console.log('showSingle()')
	let svcId = r.m.split('-')[0], iconId
	if (svcId === 'imagen' || svcId === 'gemini') iconId = 'gemini'; else if (svcId === 'grok') iconId = 'grok'; else if (svcId === 'gpt') iconId = 'gpt';
	$('link[rel="icon"]').remove()
	$('head').prepend('<link rel="icon" href="images/' + iconId + '-icon-light.svg" type="image/svg+xml" media="(prefers-color-scheme: light)"/>\n<link rel="icon" href="images/' + iconId + '-icon-dark.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)"/>')
	$('title').text(r.p)
	$('body').html('<div class="container"><h1 class="header">' + r.p + '</h1><div class="image-wrapper"><img src="' + r.i + '" alt=""><div class="footer">' + r.m + '</div></div></div>')
}

// get data from results hierarchy
async function getImageData(id) {
	return new Promise(re => {
		console.log('getImageData(' + id + ')')
		let url = 'https://raw.githubusercontent.com/' + userRepo + '/HEAD/images/' + id[0] + '/' + (id.length > 1 ? id[1] : '0') + '/' + id + '?' + Date.now()
		console.log('source url: ', url)
		$.get(url)
			.done(r => {
				if (!r) re(false)
				try {
					data = JSON.parse(r)
					/*{ // service, model, prompt, type, image data, unix timestamp (secs)
						"m": "imagen-3-generate-002",
						"p": "funny picture of a shrew", (b64)
						"i": "..." (data uri)
						"t": 123456789
					}*/
					data.p = b64Decode(data.p)
					console.log('getImageData() got image data:', data)
					re(data)
				} catch (e) {
					console.log('getImageData() error: ' + e.message)
				}
			})
			.fail(() => {
				console.log('getImageData() failed to get image data')
				re(false)
			})
	})
}

// proper base64 decode https://tinyurl.com/atob5
function b64Decode(r) {
	if (!r) return '' // tmp due to missing .p
	const bs = atob(r);
	const b = new Uint8Array(bs.length);
	for (let i = 0; i < bs.length; i++) b[i] = bs.charCodeAt(i);
	return new TextDecoder().decode(b);
}
