let user = location.pathname.indexOf("/d/code") !== -1 ? 'img4' : location.host.split('.')[0];
let userRepo = `${user}/${user}.github.io`;
let id = (location.search ? location.search.substring(1) : '').split('&')[0];
let lastIndex, pagefind;

$(async () => {
    await initSearch();
    await initLastIndex();
    if (id) { singlePagingInit(); initSingle(id); }

    document.addEventListener('keydown', (e) => {
        if (document.activeElement.id === 'search-input' && document.activeElement.value !== '') return;
        if (e.key === 'ArrowLeft' && id) singlePagingPrev();
        if (e.key === 'ArrowRight' && id) singlePagingNext();
    });
});

async function initSearch() {
    const searchInput = $('#search-input');
    try {
        pagefind = await import("/s/pagefind.js");
        await pagefind.init();
    } catch (e) {
        return searchInput.attr('placeholder', 'Search unavailable').prop('disabled', true);
    }

    searchInput.autocomplete({
        delay: 150,
        minLength: 1,
        source: async function (request, response) {
            if (!pagefind) return response([]);
            try {
                const search = await pagefind.search(request.term);
                const allResults = search.results;
                const dataResults = [];
                const CHUNK_SIZE = 100; // Processing 100 at a time

                for (let i = 0; i < allResults.length; i += CHUNK_SIZE) {
                    const chunkData = await Promise.all(allResults.slice(i, i + CHUNK_SIZE).map(r => r.data()));
                    dataResults.push(...chunkData);
                    // NO BREAK: Processing every single match
                }

                response(dataResults.map(item => ({
                    label: item.meta.title,
                    value: item.meta.title,
                    id: item.url.replace('.html', '').split('/').pop()
                })));
            } catch (err) { response([]); }
        },
        select: function (event, ui) {
            id = ui.item.id;
            history.replaceState(null, null, '?' + id);
            initSingle(id);
            if ($('#nav-middle').html() === "") singlePagingInit();
            searchInput.val(ui.item.label).blur();
            return false;
        }
    });
    $('#search-clear-btn').click(() => searchInput.val('').focus());
}

async function initLastIndex() {
    lastIndex = await getLastIndex();
    setInterval(async () => { lastIndex = await getLastIndex(true); }, 15000);
}

async function getLastIndex(poll) {
    return new Promise(re => {
        let li = localStorage.getItem('lastIndex'), lit = localStorage.getItem('lastIndexTime');
        if (!poll && li && Date.now() - parseInt(lit) <= 60000) return re(parseInt(li));
        $.get(`https://api.github.com/repos/${userRepo}/commits?per_page=5`, 'json').done(r => {
            for (let c of r) {
                if (c.commit.message.match(/^Result /)) {
                    let val = c.commit.message.split(' ')[1];
                    localStorage.setItem('lastIndex', val);
                    localStorage.setItem('lastIndexTime', Date.now().toString());
                    $('#nav-page-nitems').html(val);
                    return re(parseInt(val));
                }
            }
        }).fail(() => re(li ? parseInt(li) : null));
    });
}

function initSingle(id) {
    (async () => {
        let r = await getImageData(id);
        $('#nav-page-curitem').html(parseInt(id, 36));
        if (r) {
            if (parseInt(id, 36) > (lastIndex || 0)) $('#nav-page-nitems').html(parseInt(id, 36));
            showSingle(r);
        }
    })();
}

async function getImageData(id) {
    return new Promise(re => {
        let url = `https://raw.githubusercontent.com/${userRepo}/HEAD/images/${id[0]}/${id[1] || '0'}/${id}?${Date.now()}`;
        $.get(url).done(r => {
            let data = JSON.parse(r);
            data.p = b64Decode(data.p);
            if(data.p2) data.p2 = b64Decode(data.p2);
            re(data);
        }).fail(() => re(false));
    });
}

function showSingle(r) {
    $('title').text(r.p);
    $('#main').html(`<div class="container"><h1 class="header">${r.p}</h1><div class="image-wrapper"><img src="${r.i}"><div class="footer">${r.m}</div></div></div>`);
}

function singlePagingInit() {
    $('#nav-middle').html(`<ul class="pagination pagination-sm m-0"><li class="page-item"><a id="page-single-prev" class="page-link clickable">«</a></li><li class="page-item"><a class="page-link" style="color:#c0c0c0; pointer-events: none;"><span id="nav-page-curitem">${parseInt(id, 36)}</span> of <span id="nav-page-nitems">${lastIndex || ''}</span></a></li><li class="page-item"><a id="page-single-next" class="page-link clickable">»</a></li></ul>`);
    $('#page-single-prev').click(singlePagingPrev); $('#page-single-next').click(singlePagingNext);
}

function singlePagingPrev() { let p = parseInt(id, 36) - 1; if (p >= 1) { id = p.toString(36); history.replaceState(null, null, '?' + id); initSingle(id); } }
function singlePagingNext() { let n = parseInt(id, 36) + 1; id = n.toString(36); history.replaceState(null, null, '?' + id); initSingle(id); }
function b64Decode(r) { return r ? new TextDecoder().decode(Uint8Array.from(atob(r), c => c.charCodeAt(0))) : ''; }