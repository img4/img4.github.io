let user = location.pathname.indexOf("/d/code") !== -1 ? 'img4' : location.host.split('.')[0]
let userRepo = user + '/' + user + '.github.io'
let id = (location.search ? location.search.substring(1) : '').split('&')[0]
let lastIndex, pagefind, arInterval

$(() => {
	(async () => {
		await initLastIndex()
		await initSearch()

		// Keyboard Navigation
		document.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowLeft') {
				if (document.activeElement.id === 'search-input' && document.activeElement.value !== '') return
				if (id) singlePagingPrev()
			} else if (e.key === 'ArrowRight') {
				if (document.activeElement.id === 'search-input' && document.activeElement.value !== '') return
				if (id) singlePagingNext()
			}
		});

		if (id) {
			singlePagingInit()
			initSingle(id)
		}
	})()
})

async function initSearch() {
	try {
		// Import Pagefind from the /s folder on the 'page' branch
		pagefind = await import("/s/pagefind.js");
		await pagefind.init();
	} catch (e) {
		console.error("Search index failed to load.", e);
	}

	$('#search-input').autocomplete({
		source: async function (request, response) {
			if (!pagefind) return response([]);

			const search = await pagefind.search(request.term);
			// Fetch the top 10 results
			const results = await Promise.all(
				search.results.slice(0, 10).map(r => r.data())
			);

			response(results.map(item => {
				/**
				 * CLEANING LOGIC:
				 * Since we use the CLI to scan .html files, the URL comes back as "/id.html"
				 * We strip the leading slash and the extension to get the original ID.
				 */
				const cleanId = item.url.replace('.html', '').replace(/^\//, '');

				return {
					label: item.meta.title,
					value: item.meta.title,
					id: cleanId
				};
			}));
		},
		minLength: 1,
		select: function (event, ui) {
			id = ui.item.id;
			history.replaceState(null, null, location.origin + location.pathname + '?' + id);
			initSingle(id);
			if ($('#nav-middle').html() === "") singlePagingInit();
			$('#search-input').blur();
			return false;
		}
	});

	$('#search-clear-btn').click(() => { $('#search-input').val(''); });
}

async function initLastIndex() {
	lastIndex = await getLastIndex()
	setInterval(async () => {
		let oldIndex = lastIndex
		lastIndex = await getLastIndex(true)
		if (lastIndex > oldIndex) console.log('[poll] New images found');
	}, 15000)
}

async function getLastIndex(poll) {
	return new Promise(re => {
		let li = localStorage.getItem('lastIndex')
		let lit = localStorage.getItem('lastIndexTime')
		if (li && Date.now() - parseInt(lit) <= 60000) {
			$('#nav-page-nitems').html(li)
			return re(parseInt(li))
		}
		$.get('https://api.github.com/repos/' + userRepo + '/commits?per_page=5', 'json')
			.done(r => {
				for (let i = 0; i < r.length; i++) {
					if (r[i].commit.message.match(/^Result /)) {
						let li = r[i].commit.message.split(' ')[1].toString()
						localStorage.setItem('lastIndex', li)
						localStorage.setItem('lastIndexTime', Date.now().toString())
						$('#nav-page-nitems').html(li)
						return re(parseInt(li))
					}
				}
			})
			.fail(() => re(li ? parseInt(li) : null))
	})
}

function initSingle(id) {
	(async () => {
		let r = await getImageData(id)
		$('#nav-page-curitem').html(parseInt(id, 36));
		if (r) {
			let intId = parseInt(id, 36)
			if (intId > lastIndex) {
				lastIndex = intId
				$('#nav-page-nitems').html(lastIndex)
			}
			showSingle(r)
		}
	})()
}

async function getImageData(id) {
	return new Promise(re => {
		// Paths are derived from base36 chars: /images/x/y/id
		let url = 'https://raw.githubusercontent.com/' + userRepo + '/HEAD/images/' + id[0] + '/' + (id.length > 1 ? id[1] : '0') + '/' + id + '?' + Date.now()
		$.get(url).done(r => {
			if (!r) return re(false);
			let data = JSON.parse(r)
			data.p = b64Decode(data.p)
			if (data.p2) data.p2 = b64Decode(data.p2)
			re(data)
		}).fail(() => re(false))
	})
}

function showSingle(r) {
	$('title').text(r.p)
	$('#main').html(`<div class="container"><h1 class="header">${r.p}</h1><div class="image-wrapper"><img src="${r.i}"><div class="footer">${r.m}</div></div></div>`)
}

function singlePagingInit() {
	let nItems = lastIndex, i = parseInt(id, 36)
	$('#nav-middle').html(`<ul class="pagination pagination-sm m-0"><li class="page-item"><a id="page-single-prev" class="page-link clickable">«</a></li><li class="page-item"><a class="page-link" style="color:#c0c0c0; pointer-events: none;"><span id="nav-page-curitem">${i}</span> of <span id="nav-page-nitems">${nItems}</span></a></li><li class="page-item"><a id="page-single-next" class="page-link clickable">»</a></li></ul>`)
	$('#page-single-prev').click(singlePagingPrev);
	$('#page-single-next').click(singlePagingNext);
}

function singlePagingPrev() {
	clearInterval(arInterval);
	let prevInt = parseInt(id, 36) - 1;
	if (prevInt < 1) return;
	id = prevInt.toString(36);
	history.replaceState(null, null, '?' + id);
	initSingle(id);
}

function singlePagingNext() {
	clearInterval(arInterval);
	let nextInt = parseInt(id, 36) + 1;
	id = nextInt.toString(36);
	history.replaceState(null, null, '?' + id);
	initSingle(id);
}

function b64Decode(r) {
	if (!r) return '';
	return new TextDecoder().decode(Uint8Array.from(atob(r), c => c.charCodeAt(0)));
}