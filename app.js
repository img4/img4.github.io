let userRepo = location.host.split('.')[0] + '/' + location.pathname.split('/')[1]
let id = location.search ? location.search.substring(1) : ''

$(() => {
	// on load, view one image or gallery
	if (id) { // view one image, with link to gallery
		console.log('init single image')
		loadImageByID(id, data => {
			console.log('image data loaded. pop up modal')
		})
	} else { // view gallery, with modal images
		console.log('init gallery')
		// get latest image id
		$.get('https://raw.githubusercontent.com/' + userRepo + '/HEAD/index')
			.done(r => {
				$('body').append('<div id="single"><a download="file.jpg"><img src="'+r.i+'"></a></div>')
			})
	}

})

function loadImageByID(id, cb) {
	$.get('https://raw.githubusercontent.com/' + userRepo + '/HEAD/images/' + id[0] + '/' + (id.length > 1 ? id[1] : '0') + '/' + id)
		.done(r => {
			try {
				data = JSON.parse(r)/*
						{ // service, model, prompt, type, image data
							"s": "Gemini",
							"m": "imagen-3-generate-002",
							"p": "funny picture of a shrew", (b64)
							"t": "image/png",
							"i": "..." (data uri)
						}*/
				data.p = b64Decode(data.p)
				console.log('got image data:', data)
				return data
			} catch (e) {
				$('body').text('loadImageByID() error: ' + e.message)
				console.log('r:', r)
			}
		})
		.fail(() => {
			$('body').text('Image not found') // TODO link gallery, or forward automatically
		});
}

function b64Decode(r) {
	const bs = atob(r); // https://tinyurl.com/atob5
	const b = new Uint8Array(bs.length);
	for (let i = 0; i < bs.length; i++) b[i] = bs.charCodeAt(i);
	return new TextDecoder().decode(b);
}
