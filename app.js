let user = location.pathname.indexOf("/d/code") !== -1 ? 'img4' : location.host.split('.')[0];
let userRepo = `${user}/${user}.github.io`;
let id = (location.search ? location.search.substring(1) : '').split('&')[0];
let lastIndex, pagefind, autoRefreshInterval;

$(async () => {
	await initLastIndex();
	await initSearch();

	if (id) {
		singlePagingInit();
		initSingle(id);
	} else if (!('ontouchstart' in window)) {
		$('#search-input').focus();
	}

	document.addEventListener('keydown', (e) => {
		if (document.activeElement.id === 'search-input' && document.activeElement.value !== '') return;
		if (e.key === 'ArrowLeft' && id) singlePagingPrev();
		if (e.key === 'ArrowRight' && id) singlePagingNext();
	});

	// Enhanced Swipe Logic
	let touchStartX = 0;
	let touchStartY = 0;
	document.addEventListener('touchstart', (e) => {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}, { passive: true });

	document.addEventListener('touchend', (e) => {
		if (!id) return;
		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		const diffX = touchStartX - touchEndX;
		const diffY = touchStartY - touchEndY;

		// Ensure horizontal swipe is dominant to exceeds threshold
		if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
			if (diffX > 0) singlePagingNext();
			else singlePagingPrev();
		}
	}, { passive: true });
});

async function initSearch() {
	const searchInput = $('#search-input');
	try {
		pagefind = await import("/s/pagefind.js");
		await pagefind.init();
	} catch (e) {
		return searchInput.attr('placeholder', 'Search unavailable').prop('disabled', true);
	}

	let loadingTimer;
	searchInput.autocomplete({
		delay: 150,
		minLength: 2,
		source: async function (request, response) {
			if (!pagefind) return response([]);
			try {
				const search = await pagefind.search(request.term);
				const allResults = search.results;
				const dataResults = [];
				const CHUNK_SIZE = 500;

				for (let i = 0; i < allResults.length; i += CHUNK_SIZE) {
					const chunkData = await Promise.all(allResults.slice(i, i + CHUNK_SIZE).map(r => r.data()));
					dataResults.push(...chunkData);
				}

				clearTimeout(loadingTimer);
				response(dataResults.map(item => ({
					label: item.meta.title,
					value: item.meta.title,
					id: item.url.replace('.html', '').split('/').pop()
				})));
			} catch (err) { clearTimeout(loadingTimer); response([]); }
		},
		search: function () {
			clearTimeout(loadingTimer);
			loadingTimer = setTimeout(() => {
				const instance = searchInput.autocomplete('instance');
				instance.menu.element.html('<li class="ui-menu-item"><div class="ui-menu-item-wrapper">Loading...</div></li>').show();
				instance.menu.element.position({ my: 'left top', at: 'left bottom', of: searchInput });
			}, 500);
		},
		select: function (event, ui) {
			if (!ui.item.id) return false;
			id = ui.item.id;
			history.replaceState(null, null, '?' + id);
			initSingle(id);
			singlePagingInit();
			searchInput.blur();
			return false;
		}
	}).autocomplete('instance')._renderItem = function (ul, item) {
		const li = $('<li>').text(item.label);
		if (item.id === id) li.css('background-color', '#c8c8c8');
		return li.appendTo(ul);
	};

	searchInput.on('mouseenter', function () {
		const val = $(this).val();
		if (val.length >= 2) {
			$(this).autocomplete("search", val);
		}
	});

	$('#search-clear-btn').click(() => searchInput.val('').focus());
}

async function initLastIndex() {
	lastIndex = await getLastIndex();
	setInterval(async () => {
		const updated = await getLastIndex(true);
		if (updated > lastIndex) {
			lastIndex = updated;
			$('#nav-page-nitems').html(lastIndex);
		}
	}, 15000);
}

async function getLastIndex(poll) {
	return new Promise(re => {
		let li = localStorage.getItem('lastIndex');
		$.get('./high_id').done(r => {
			let val = parseInt(r.trim());
			let cur = localStorage.getItem('lastIndex') ? parseInt(localStorage.getItem('lastIndex')) : 0;
			if (val > cur) {
				localStorage.setItem('lastIndex', val);
				localStorage.setItem('lastIndexTime', Date.now().toString());
				$('#nav-page-nitems').html(val);
				re(val);
			} else {
				$('#nav-page-nitems').html(cur);
				re(cur);
			}
		}).fail(() => {
			let val = li ? parseInt(li) : 0;
			$('#nav-page-nitems').html(val);
			re(val);
		});
	});
}

function initSingle(id) {
	if (autoRefreshInterval) clearInterval(autoRefreshInterval);
	(async () => {
		let r = await getImageData(id);
		if (id !== (location.search ? location.search.substring(1) : '').split('&')[0]) return;
		const intId = parseInt(id, 36);
		$('#nav-page-curitem').html(intId);
		if (r) {
			// if found image has id greater than lastIndex, update lastIndex
			if (intId > lastIndex) {
				console.log('found id ' + intId + ' > lastIndex ' + lastIndex + ', updating');
				lastIndex = intId;
				localStorage.setItem('lastIndex', lastIndex.toString());
				localStorage.setItem('lastIndexTime', Date.now().toString());
				$('#nav-page-nitems').html(lastIndex);
			}
			showSingle(r);
		} else {
			$('link[rel="icon"]').remove();
			$('title').text('Not found');
			console.log('image not found. start auto-refresh (id=' + id + ')');
			$('#main').html('<div id="notfound"><b>Image ' + id + ' not found</b><br>New images can take a few seconds to propagate<br><div id="auto-refresh-wrap">Auto-refreshing every 3s for 5m...<br><div class="spinner-border text-primary" role="status" style="margin-top:5px"><span class="visually-hidden">Loading...</span></div></div><a id="refresh-btn" class="btn btn-primary" style="display:none; margin-top:5px">Refresh</a><br></div>');
			let arWrap = $('#auto-refresh-wrap');
			let refreshBtn = $('#refresh-btn');
			let arStartTime;

			let checkIt = function () {
				(async () => {
					console.log('checkIt(' + id + ')');
					if (Date.now() - arStartTime > 300000) {
						console.log('auto-refresh timeout, showing restart button');
						clearInterval(autoRefreshInterval);
						arWrap.hide();
						refreshBtn.show();
					}
					r = await getImageData(id);
					if (r) {
						clearInterval(autoRefreshInterval);
						showSingle(r);
					}
				})();
			};

			function autoRefreshStart(first) {
				console.log('autoRefreshStart(' + id + ')');
				refreshBtn.hide();
				arWrap.show();
				arStartTime = Date.now();
				if (autoRefreshInterval) clearInterval(autoRefreshInterval);
				autoRefreshInterval = setInterval(checkIt, 3000);
				if (!first) checkIt();
			}

			autoRefreshStart(true);

			refreshBtn.click(function () {
				autoRefreshStart();
			});
		}
	})();
}

async function getImageData(id) {
	return new Promise(re => {
		let url = `https://raw.githubusercontent.com/${userRepo}/HEAD/images/${id[0]}/${id[1] || '0'}/${id}?${Date.now()}`;
		$.get(url).done(r => {
			let data = JSON.parse(r);
			data.p = b64Decode(data.p);
			if (data.p2) data.p2 = b64Decode(data.p2);
			re(data);
		}).fail(() => re(false));
	});
}

function showSingle(r) {
	$('title').text(r.p);
	$('#main').html(`<div class="container"><h1 class="header">${r.p}</h1><div class="image-wrapper"><img src="${r.i}"><div class="footer">${r.m}</div></div></div>`);
}

function singlePagingInit() {
	const currentDisplay = id ? parseInt(id, 36) : '...';
	const totalDisplay = lastIndex || currentDisplay;

	$('#nav-middle').html(`
        <ul class="pagination pagination-sm m-0">
            <li class="page-item"><a id="page-single-prev" class="page-link clickable" style="touch-action: manipulation; -webkit-user-select: none;">«</a></li>
            <li class="page-item">
                <a class="page-link" style="color:#c0c0c0; pointer-events: none;">
                    <span id="nav-page-curitem">${currentDisplay}</span> of <span id="nav-page-nitems">${totalDisplay}</span>
                </a>
            </li>
            <li class="page-item"><a id="page-single-next" class="page-link clickable" style="touch-action: manipulation; -webkit-user-select: none;">»</a></li>
        </ul>`);

	let longPressTimer;
	let isLongPress = false;

	// Prev Button logic
	$('#page-single-prev').off()
		.on('touchstart', function (e) {
			isLongPress = false;
			longPressTimer = setTimeout(() => {
				isLongPress = true;
				id = '1';
				history.replaceState(null, null, '?1');
				initSingle('1');
			}, 2000);
		})
		.on('touchend', function (e) {
			clearTimeout(longPressTimer);
			if (!isLongPress) singlePagingPrev();
			e.preventDefault(); // Stop ghost clicks and zoom delays
		})
		.on('mousedown', function () { // Desktop fallback
			longPressTimer = setTimeout(() => { id = '1'; history.replaceState(null, null, '?1'); initSingle('1'); }, 2000);
		})
		.on('mouseup mouseleave', function () { clearTimeout(longPressTimer); })
		.click(function (e) {
			if (e.detail > 0) singlePagingPrev(); // Real mouse clicks only
		});

	// Next Button logic
	$('#page-single-next').off()
		.on('touchstart', function (e) {
			isLongPress = false;
			longPressTimer = setTimeout(() => {
				isLongPress = true;
				if (lastIndex) {
					id = lastIndex.toString(36);
					history.replaceState(null, null, '?' + id);
					initSingle(id);
				}
			}, 2000);
		})
		.on('touchend', function (e) {
			clearTimeout(longPressTimer);
			if (!isLongPress) singlePagingNext();
			e.preventDefault();
		})
		.on('mousedown', function () { // Desktop fallback
			isLongPress = false;
			longPressTimer = setTimeout(() => {
				isLongPress = true;
				if (lastIndex) {
					id = lastIndex.toString(36);
					history.replaceState(null, null, '?' + id);
					initSingle(id);
				}
			}, 2000);
		})
		.on('mouseup mouseleave', function () { clearTimeout(longPressTimer); })
		.click(function (e) {
			if (isLongPress) return;
			if (e.detail > 0) singlePagingNext();
		});
}

function singlePagingPrev() {
	let p = parseInt(id, 36) - 1;
	if (p >= 1) {
		if ('ontouchstart' in window && document.activeElement) document.activeElement.blur();
		id = p.toString(36);
		history.replaceState(null, null, '?' + id);
		initSingle(id);
		singlePagingInit();
	}
}

function singlePagingNext() {
	let n = parseInt(id, 36) + 1;
	if ('ontouchstart' in window && document.activeElement) document.activeElement.blur();
	id = n.toString(36);
	history.replaceState(null, null, '?' + id);
	initSingle(id);
	singlePagingInit();
}

function b64Decode(r) { return r ? new TextDecoder().decode(Uint8Array.from(atob(r), c => c.charCodeAt(0))) : ''; }