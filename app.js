let user = location.pathname.indexOf("/d/code") !== -1 ? 'img4' : location.host.split('.')[0];
let userRepo = `${user}/${user}.github.io`;
let id = (location.search ? location.search.substring(1) : '').split('&')[0];
let lastIndex, pagefind;

$(async () => {
	await initLastIndex();
	await initSearch();

	if (id) {
		singlePagingInit();
		initSingle(id);
	} else {
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

		// Ensure horizontal swipe is dominant to avoid firing during vertical scrolls
		if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
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
		let li = localStorage.getItem('lastIndex'), lit = localStorage.getItem('lastIndexTime');
		if (!poll && li && Date.now() - parseInt(lit) <= 60000) {
			$('#nav-page-nitems').html(li);
			return re(parseInt(li));
		}
		$.get(`https://api.github.com/repos/${userRepo}/commits?per_page=10`, 'json').done(r => {
			for (let c of r) {
				const match = c.commit.message.match(/^Result (\d+)/);
				if (match) {
					let val = match[1];
					localStorage.setItem('lastIndex', val);
					localStorage.setItem('lastIndexTime', Date.now().toString());
					$('#nav-page-nitems').html(val);
					return re(parseInt(val));
				}
			}
			re(li ? parseInt(li) : 0);
		}).fail(() => re(li ? parseInt(li) : 0));
	});
}

function initSingle(id) {
	(async () => {
		let r = await getImageData(id);
		const currentInt = parseInt(id, 36);
		$('#nav-page-curitem').html(currentInt);
		if (lastIndex && currentInt > lastIndex) {
			lastIndex = currentInt;
			$('#nav-page-nitems').html(lastIndex);
		}
		if (r) showSingle(r);
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
				if (lastIndex) {
					isLongPress = true;
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
			longPressTimer = setTimeout(() => { if (lastIndex) { id = lastIndex.toString(36); history.replaceState(null, null, '?' + id); initSingle(id); } }, 2000);
		})
		.on('mouseup mouseleave', function () { clearTimeout(longPressTimer); })
		.click(function (e) {
			if (e.detail > 0) singlePagingNext();
		});
}

function singlePagingPrev() {
	let p = parseInt(id, 36) - 1;
	if (p >= 1) {
		id = p.toString(36);
		history.replaceState(null, null, '?' + id);
		initSingle(id);
	}
}

function singlePagingNext() {
	let n = parseInt(id, 36) + 1;
	if (lastIndex && n > lastIndex) return;
	id = n.toString(36);
	history.replaceState(null, null, '?' + id);
	initSingle(id);
}

function b64Decode(r) { return r ? new TextDecoder().decode(Uint8Array.from(atob(r), c => c.charCodeAt(0))) : ''; }