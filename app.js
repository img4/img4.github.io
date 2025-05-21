let userRepo
if (location.pathname.indexOf("C:") !== -1) userRepo = 'img4/i' // local dev
else userRepo = location.host.split('.')[0] + '/' + location.pathname.split('/')[1]
let id = location.search ? location.search.substring(1) : ''

$(() => {
	// on load, view one image or gallery
	if (id) { // view one image, with link to gallery
		// bind left and right keys to increase or decrease id
		document.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowLeft'){
				let prevId = (parseInt(id, 36) - 1).toString(36)
				if(prevId<1) prevId=1
				location = location.origin + location.pathname + '?' + prevId
			}
			else if (e.key === 'ArrowRight'){
				let nextId = (parseInt(id, 36) + 1).toString(36)
				location = location.origin + location.pathname + '?' + nextId
			}
		});
		console.log('init single image')
		loadImageByID(id, r => {
			// show image
			console.log('show image')
			let svcId = r.m.split('-')[0], iconId
			if (svcId === 'imagen' || svcId === 'gemini') iconId = 'gemini'; else if (svcId === 'grok') iconId = 'grok'; else if (svcId === 'gpt') iconId = 'gpt';
			$('head').prepend('<link rel="icon" href="images/' + iconId + '-icon-light.svg" type="image/svg+xml" media="(prefers-color-scheme: light)"/>\n<link rel="icon" href="images/' + iconId + '-icon-dark.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)"/>')
			$('title').text(r.p)
			$('body').append('<div class="container"><h1 class="header">' + r.p + '</h1><div class="image-wrapper"><img src="' + r.i + '" alt=""><div class="footer">' + r.m + '</div></div></div>')
		})
	} else { // view gallery, with modal images
		console.log('init gallery')
		// get latest image id
		$.get('https://raw.githubusercontent.com/' + userRepo + '/HEAD/index')
			.done(r => {
				console.log('r:', r)
			})
	}
})

function loadImageByID(id, cb) {
	let url = 'https://raw.githubusercontent.com/' + userRepo + '/HEAD/images/' + id[0] + '/' + (id.length > 1 ? id[1] : '0') + '/' + id
	console.log('source url: ', url)
	$.get(url)
		.done(r => {
			try {
				data = JSON.parse(r)
				/*
										{ // service, model, prompt, type, image data
											"s": "Gemini",
											"m": "imagen-3-generate-002",
											"p": "funny picture of a shrew", (b64)
											"t": "image/png",
											"i": "..." (data uri)
										}*/
				data.p = b64Decode(data.p)
				console.log('image data:', data)
				cb(data)
			} catch (e) {
				console.log('loadImageByID() error: ' + e.message)
			}
		})
		.fail(() => {
			$('body').html('<div id="notfound"><b>Image not found</b><br>New images can take a few seconds<br><a class="btn btn-primary" href="javascript:window.location.href=window.location.href">Refresh</a></div>') // TODO link gallery, or forward automatically
		});
}

function b64Decode(r) {
	if (!r) return '' // tmp due to missing .p
	const bs = atob(r); // https://tinyurl.com/atob5
	const b = new Uint8Array(bs.length);
	for (let i = 0; i < bs.length; i++) b[i] = bs.charCodeAt(i);
	return new TextDecoder().decode(b);
}
