function http_build_query(formdata, numeric_prefix = '', arg_separator = '&') {
	let key,
		use_val,
		use_key,
		i = 0,
		tmp_arr = []

	if (!arg_separator) {
		arg_separator = '&'
	}

	for (key in formdata) {
		use_key = escape(key)
		use_val = escape(formdata[key].toString())
		use_val = use_val.replace(/%20/g, '+')

		if (numeric_prefix && !isNaN(key)) {
			use_key = numeric_prefix + i
		}
		tmp_arr[i] = use_key + '=' + use_val
		i++
	}
	return tmp_arr.join(arg_separator)
}

function Sleep(sleep) {
	return new Promise(resolve => {
		setTimeout(() => resolve(), sleep) // it takes 2 seconds to make coffee
	})
}

async function avgYUV(data) {
	let rgb = { r: 0, g: 0, b: 0 }
	let yuv = { y: 0, u: 0, v: 0 }
	let count = 0
	for (let i = 0; i < data.data.length; i = i + 4) {
		rgb.r = data.data[i] / 255
		rgb.g = data.data[i + 1] / 255
		rgb.b = data.data[i + 2] / 255

		yuv.y += 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b
		yuv.u += -0.147 * rgb.r - 0.289 * rgb.g + 0.436 * rgb.b
		yuv.v += 0.615 * rgb.r - 0.515 * rgb.g - 0.1 * rgb.b

		count += 1
	}

	yuv.y = yuv.y / count
	yuv.u = yuv.u / count
	yuv.v = yuv.v / count

	yuv.y = await sigma(yuv.y)
	yuv.u = await sigma(yuv.u)
	yuv.v = await sigma(yuv.v)

	rgb.r = yuv.y + 1.3983 * yuv.v
	rgb.g = yuv.y - 0.3946 * yuv.u - 0.5806 * yuv.v
	rgb.b = yuv.y + 2.0321 * yuv.u

	rgb.r = ~~(rgb.r * 255)
	rgb.g = ~~(rgb.g * 255)
	rgb.b = ~~(rgb.b * 255)

	return rgb
}

async function changeColor({ r, g, b }) {
	let o = Math.round((parseInt(r) * 299 + parseInt(g) * 587 + parseInt(b) * 114) / 1000)
	return o > 115
}
async function rgbToHex({ r, g, b }) {
	return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b)
}
function componentToHex(c) {
	let hex = c.toString(16)
	return hex.length == 1 ? '0' + hex : hex
}
async function sigma(x) {
	return x / (Math.abs(x) + 0.4)
}

export { http_build_query, Sleep,avgYUV,changeColor,rgbToHex }
