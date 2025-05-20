let userRepo = location.host.split('.')[0] + '/' + location.pathname.split('/')[1]
let id = location.search ? location.search.substring(1) : ''

$(() => {
	// on load, view one image or gallery
	if (id) { // view one image, with link to gallery
		console.log('init single image')
		loadImageByID(id, r => {
			console.log('image data loaded. show image. r:', r)
			let svcId = r.m.split('-')[0], iconId
			if (svcId === 'imagen' || svcId === 'gemini') iconId = 'gemini'; else if (svcId === 'grok') iconId = 'grok'; else if (svcId === 'gpt') iconId = 'gpt';
			$('head').prepend('<link rel="icon" href="images/' + iconId + '-icon-light.svg" type="image/svg+xml" media="(prefers-color-scheme: light)"/>\n<link rel="icon" href="images/' + iconId + '-icon-dark.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)"/>')
			$('title').text(r.p)
			$('body').append('<div id="single"><div id="prompt">' + r.p + '</div><img src="' + r.i + '" alt=""/></div>')
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
	console.log('loadImageByID() url:', url)
	$.get(url)
		.done(r => {
			try {
				data = JSON.parse(r)
				console.log('got image data [orig]:', data)
				/*
										{ // service, model, prompt, type, image data
											"s": "Gemini",
											"m": "imagen-3-generate-002",
											"p": "funny picture of a shrew", (b64)
											"t": "image/png",
											"i": "..." (data uri)
										}*/
				data.p = b64Decode(data.p)
				console.log('got image data:', data)
				cb(data)
			} catch (e) {
				console.log('loadImageByID() error: ' + e.message)
			}
		})
		.fail(() => {
			$('body').text('Image not found') // TODO link gallery, or forward automatically
		});
}

function b64Decode(r) {
	if (!r) return '' // tmp due to missing .p
	const bs = atob(r); // https://tinyurl.com/atob5
	const b = new Uint8Array(bs.length);
	for (let i = 0; i < bs.length; i++) b[i] = bs.charCodeAt(i);
	return new TextDecoder().decode(b);
}
