let user = location.pathname.indexOf("/d/code") !== -1 ? 'img4' : location.host.split('.')[0];
let userRepo = user + '/' + user + '.github.io';
let id = (location.search ? location.search.substring(1) : '').split('&')[0];
let lastIndex, pagefind, arInterval;

$(async () => {
    console.log("App initializing...");

    // 1. Initialize Search First
    try {
        await initSearch();
    } catch (e) {
        console.error("Search initialization aborted:", e);
    }

    // 2. Initialize background data
    await initLastIndex();

    // 3. Handle specific image view if ID in URL
    if (id) {
        singlePagingInit();
        initSingle(id);
    }

    // 4. Keyboard Navigation
    document.addEventListener('keydown', (e) => {
        // Don't trigger paging if user is typing in search box
        if (document.activeElement.id === 'search-input' && document.activeElement.value !== '') return;
        
        if (e.key === 'ArrowLeft') {
            if (id) singlePagingPrev();
        } else if (e.key === 'ArrowRight') {
            if (id) singlePagingNext();
        }
    });
});

async function initSearch() {
    const searchInput = $('#search-input');
    
    // Load Pagefind Module
    try {
        console.log("Fetching search index...");
        // This must match the output-path in your GitHub Action
        pagefind = await import("/s/pagefind.js");
        await pagefind.init();
        console.log("Search engine ready.");
        searchInput.attr('placeholder', 'Search images...');
    } catch (e) {
        console.warn("Pagefind not found at /s/pagefind.js. Search will be disabled.", e);
        searchInput.attr('placeholder', 'Search unavailable').prop('disabled', true);
        return;
    }

    // Initialize jQuery UI Autocomplete
    searchInput.autocomplete({
        delay: 150,
        minLength: 1,
        source: async function (request, response) {
            if (!pagefind) return response([]);
            
            try {
                const search = await pagefind.search(request.term);
                // Get top 10 matches
                const results = await Promise.all(
                    search.results.slice(0, 10).map(r => r.data())
                );

                response(results.map(item => {
                    // Convert "/id.html" or "id.html" to just "id"
                    const cleanId = item.url.replace('.html', '').split('/').pop();
                    return {
                        label: item.meta.title,
                        value: item.meta.title,
                        id: cleanId
                    };
                }));
            } catch (err) {
                console.error("Search execution failed:", err);
                response([]);
            }
        },
        select: function (event, ui) {
            id = ui.item.id;
            history.replaceState(null, null, location.origin + location.pathname + '?' + id);
            initSingle(id);
            if ($('#nav-middle').html() === "") singlePagingInit();
            searchInput.blur();
            return false;
        }
    });

    $('#search-clear-btn').click(() => { 
        searchInput.val('').focus(); 
    });
}

async function initLastIndex() {
    lastIndex = await getLastIndex();
    setInterval(async () => {
        let oldIndex = lastIndex;
        lastIndex = await getLastIndex(true);
        if (lastIndex > oldIndex) console.log('[poll] New images found');
    }, 15000);
}

async function getLastIndex(poll) {
    return new Promise(re => {
        let li = localStorage.getItem('lastIndex');
        let lit = localStorage.getItem('lastIndexTime');
        
        // Use cache if less than 60 seconds old
        if (!poll && li && Date.now() - parseInt(lit) <= 60000) {
            $('#nav-page-nitems').html(li);
            return re(parseInt(li));
        }

        $.get('https://api.github.com/repos/' + userRepo + '/commits?per_page=5', 'json')
            .done(r => {
                for (let i = 0; i < r.length; i++) {
                    if (r[i].commit.message.match(/^Result /)) {
                        let liVal = r[i].commit.message.split(' ')[1].toString();
                        localStorage.setItem('lastIndex', liVal);
                        localStorage.setItem('lastIndexTime', Date.now().toString());
                        $('#nav-page-nitems').html(liVal);
                        return re(parseInt(liVal));
                    }
                }
            })
            .fail(() => re(li ? parseInt(li) : null));
    });
}

function initSingle(id) {
    (async () => {
        let r = await getImageData(id);
        $('#nav-page-curitem').html(parseInt(id, 36));
        if (r) {
            let intId = parseInt(id, 36);
            if (intId > lastIndex) {
                lastIndex = intId;
                $('#nav-page-nitems').html(lastIndex);
            }
            showSingle(r);
        }
    })();
}

async function getImageData(id) {
    return new Promise(re => {
        let url = 'https://raw.githubusercontent.com/' + userRepo + '/HEAD/images/' + id[0] + '/' + (id.length > 1 ? id[1] : '0') + '/' + id + '?' + Date.now();
        $.get(url).done(r => {
            if (!r) return re(false);
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
    let nItems = lastIndex || '...', i = id ? parseInt(id, 36) : '...';
    $('#nav-middle').html(`<ul class="pagination pagination-sm m-0"><li class="page-item"><a id="page-single-prev" class="page-link clickable">«</a></li><li class="page-item"><a class="page-link" style="color:#c0c0c0; pointer-events: none;"><span id="nav-page-curitem">${i}</span> of <span id="nav-page-nitems">${nItems}</span></a></li><li class="page-item"><a id="page-single-next" class="page-link clickable">»</a></li></ul>`);
    $('#page-single-prev').off().click(singlePagingPrev);
    $('#page-single-next').off().click(singlePagingNext);
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
    try {
        return new TextDecoder().decode(Uint8Array.from(atob(r), c => c.charCodeAt(0)));
    } catch(e) {
        return r; // Return as is if not valid base64
    }
}