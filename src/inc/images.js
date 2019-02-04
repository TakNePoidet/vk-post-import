import gm from 'gm'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import canvasNode from 'canvas'
import imagemin from 'imagemin'
import imageminJpegtran from 'imagemin-jpegtran'
import smartcrop from 'smartcrop-gm'

import { avgYUV } from './function'

gm.subClass({ imageMagick: true })

async function saveFoto(item, photo) {
	let responseFoto = await axios({
		url: photo,
		method: 'GET',
		responseType: 'arraybuffer'
	})
	let path = `./images/temp/vk_id_${item.id}.png`
	let res = fs.writeFileSync(path, Buffer.from(responseFoto.data, 'binary'))
	return path
}

async function ImageResize(path, width, out) {
	return new Promise(function(resolve, reject) {
		gm(path)
			.resize(width)
			.write(out, function(err) {
				if (!err) {
					resolve(true)
				} else {
					reject(err)
				}
			})
	})
}
async function applySmartCrop(sourse, dest, width, height) {
	smartcrop.crop(fs.readFileSync(sourse), { width: width, height: height }).then(function(result) {
		let crop = result.topCrop
		gm(sourse)
			.crop(crop.width, crop.height, crop.x, crop.y)
			.resize(width, height)
			.write(dest, function(error) {
				if (error) return console.error(error)
			})
	})
	return path.basename(dest)
}

async function getImageSize(path) {
	return new Promise(function(resolve, reject) {
		gm(path).size(function(err, val) {
			if (!err) {
				resolve(val)
			} else {
				console.log(err)
			}
		})
	})
}

async function imagesMinify(path, dist) {
	await imagemin([path], dist, { plugins: [imageminJpegtran()] })
}

async function getMediumColor(path) {
	let { width, height } = await getImageSize(path)
	let canvas = canvasNode.createCanvas(width, height),
		ctx = canvas.getContext('2d')
	let img = new canvasNode.Image()
	img.src = fs.readFileSync(path)

	ctx.drawImage(img, 0, 0, 600, 600)

	let data = ctx.getImageData(0, 0, 600, 600)
	let color = await avgYUV(data)

	return color
}

export { saveFoto, ImageResize, applySmartCrop, getImageSize, imagesMinify, getMediumColor }
