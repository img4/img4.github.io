let userRepo = location.pathname.indexOf("/d/code") !== -1 ? 'img4/i' /* local dev */ : location.host.split('.')[0] + '/' + location.pathname.split('/')[1]
let id = (location.search ? location.search.substring(1) : '').split('&')[0]
let lastIndex, searchData, arInterval

$(() => {
	(async () => {
		searchData = await getSearchData()
		setInterval(() => {
			(async () => {
				searchData = await getSearchData(true)
			})()
		}, 120000)

		// activate search box
		function fuzzyMatch(str, query) {
			const strWords = str.toLowerCase().split(/\s+/);
			const queryWords = query.toLowerCase().trim().split(/\s+/);
			// Every query word must be a substring of some word in str
			return queryWords.every(qWord =>
				strWords.some(sWord => sWord.includes(qWord))
			);
		}
		$('#search-input').autocomplete({
			source: function(request, response) {
				const term = request.term.toLowerCase();
				const matches = searchData
					.filter(item => item.p.toLowerCase().includes(term) || fuzzyMatch(item.p, term))
					.map(item => ({
						label: item.p,
						value: item.p,
						id: item.id
					}));
				// console.log('Search query:', term, 'Matches:', matches);
				response(matches);
			},
			minLength: 1,
			select: function(event, ui) {
				// console.log('Selected item ID:', ui.item.id);
				initSingle(ui.item.id)
			},
			close: ()=>{
				$('#search-input').val('')
				console.log('arf')
			},
			open: function(event, ui) {
				// console.log('Dropdown opened with items:', $(this).autocomplete('widget').find('.ui-menu-item').length);
			}
		});

		// get lastIndex and poll regularly
		// TODO pause polling when not focused
		lastIndex = await getLastIndex()
		setInterval(() => {
			(async () => {
				let oldIndex = lastIndex
				lastIndex = await getLastIndex(true)
				// TODO when it increases, toast that there are new images
				if (lastIndex > oldIndex) {
					console.log('[poll] lastIndex > oldIndex = new images')
				}
			})()
		}, 15000)

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
			// TODO
		}
	})()
})

// store highest image id so know where to browse, e.g. with arrow keys or paging or next buttons, and where to start gallery
// value obtained by parsing commit messages for e.g. 'Result 123'. unauthed rate limit 60/h
async function getLastIndex(poll) {
	return new Promise(re => {
		let li = localStorage.getItem('lastIndex')
		let lit = localStorage.getItem('lastIndexTime')
		if (li && Date.now() - parseInt(lit) <= 60000) {
			console.log((poll ? '[poll] ' : '') + 'getLastIndex() cached =', li)
			return re(parseInt(li))
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
			.fail(e => {
				console.log('getLastIndex() failed, e:', e)
				let li = localStorage.getItem('lastIndex')
				if (li) {
					console.log('getLastIndex() failed, returning cached =', li)
					return re(parseInt(li))
				} else {
					console.log('getLastIndex() fatal error, no lastIndex in cache. returning null')
					return re(null)
				}
			})
	})
}

// get search data, stored compressed
async function getSearchData(poll) {
	return new Promise(re => {
		let sd = localStorage.getItem('searchData')
		let sdt = localStorage.getItem('searchDataTime')
		if (sd && Date.now() - parseInt(sdt) <= 60000) {
			sd = LZString.decompressFromBase64(sd)
			sd = JSON.parse(sd)
			console.log((poll ? '[poll] ' : '') + 'getSearchData() cached =', sd)
			return re(sd)
		}
		$.get('https://raw.githubusercontent.com/' + userRepo + '/HEAD/search.json.lz')
			.done(sd => {
				try {
					localStorage.setItem('searchData', sd)
					localStorage.setItem('searchDataTime', Date.now().toString())
					sd = LZString.decompressFromBase64(sd);
					sd = JSON.parse(sd);
					console.log((poll ? '[poll] ' : '') + 'getSearchData() refreshed =', sd)
					return re(sd)
				} catch (e) {
					// document.getElementById('output').innerText = "Decompressed data (not JSON): " + decompressed;
					console.error("getSearchData() error:", e);
					sd = localStorage.getItem('searchData')
					if (sd) {
						sd = LZString.decompressFromBase64(sd);
						sd = JSON.parse(sd);
						console.log('getSearchData() failed, returning cached =', sd)
						return re(sd)
					} else {
						console.log('getSearchData() fatal error, no searchData in cache. returning null')
						return re(null)
					}
				}
			})
			.fail(e => {
				console.log('getSearchData() dl failed, e:', e)
				let sd = localStorage.getItem('searchData')
				if (sd) {
					sd = LZString.decompressFromBase64(sd)
					sd = JSON.parse(sd)
					console.log('getSearchData() dl failed, returning cached =', sd)
					return re(sd)
				} else {
					console.log('getSearchData() fatal error, no searchData in cache. returning null')
					return re(null)
				}
			})
	})
}

// begin display for a single image. show or auto-refresh
function initSingle(id) {
	(async () => {
		console.log('initSingle(' + id + ')')
		let r, arStartTime, arWrap, refreshBtn
		r = await getImageData(id)
		if (r) {
			// if found image has id greater than lastIndex, update lastIndex. this provides functionality before the regular polling that will soon find it
			let intId = parseInt(id, 36)
			if (intId > lastIndex) {
				console.log('found id ' + intId + ' > lastIndex ' + lastIndex + ', updating')
				lastIndex = intId
				localStorage.setItem('lastIndex', lastIndex.toString())
				localStorage.setItem('lastIndexTime', Date.now().toString())
			}
			showSingle(r)
		} else {
			$('link[rel="icon"]').remove()
			$('title').text('Not found')
			console.log('image not found. start auto-refresh (id=' + id + ')')
			$('#main').html('<div id="notfound"><b>Image ' + id + ' not found</b><br>New images can take a few seconds to propagate<br><div id="auto-refresh-wrap">Auto-refreshing every 3s for 5m...<br><div class="spinner-border text-primary" role="status" style="margin-top:5px"><span class="visually-hidden">Loading...</span></div></div><a id="refresh-btn" class="btn btn-primary" style="display:none; margin-top:5px" >Refresh</a><br></div>')
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
	$('#main').html('<div class="container"><h1 class="header">' + r.p + '</h1><div class="image-wrapper"><img src="' + r.i + '" alt=""><div class="footer">' + r.m + '</div></div></div>')
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
