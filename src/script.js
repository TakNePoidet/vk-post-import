import fs from 'fs'
import crypto from 'crypto'
import moment from 'moment'
import axios from 'axios'
import md5File from 'md5-file'
import '@babel/polyfill'
import Database from './inc/database'
import { http_build_query, Sleep, changeColor, rgbToHex } from './inc/function'
import { saveFoto, applySmartCrop, getImageSize, imagesMinify, getMediumColor, ImageResize } from './inc/images'
import dotenv from 'dotenv'

dotenv.config()

const { TOKEN, DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = process.env

const database = new Database({
	host: DB_HOST,
	port: DB_PORT,
	user: DB_USERNAME,
	password: DB_PASSWORD,
	database: DB_DATABASE,
	charset: 'utf8mb4'
})
let databaseInterval = setInterval(function() {
	database.query('SELECT 1')
}, 5000)

let params = http_build_query({
	filter: 'owner',
	count: 20,
	offset: 0,
	access_token: TOKEN,
	v: '5.91'
})

let data = {}
let items_vk = []
let md5FilesVK = []

async function Start() {
	try {
		if (!fs.existsSync('./images')) {
			fs.mkdirSync('./images')
		}
		if (!fs.existsSync('./images/ready')) {
			fs.mkdirSync('./images/ready')
		}
		if (!fs.existsSync('./images/temp')) {
			fs.mkdirSync('./images/temp')
		}

		const res = await axios('https://api.vk.com/method/wall.get?' + params)

		if (typeof res.data.response !== 'undefined') {
			let response = res.data.response
			for await (let item of response.items) {
				if (item.post_type === 'post' || item.post_type === 'photo') {
					if (item.attachments) {
						let attachments = item.attachments.filter(attachment => attachment.type === 'photo')
						if (attachments.length < 1) continue

						let date = moment(item.date * 1000)
						let dayPath = date.format('YYYY-MM-DD')
						let mainPath = `./images/ready/${dayPath}`

						let photo = attachments[0].photo
						let path = await saveFoto(item, photo.sizes[photo.sizes.length - 1].url)
						let hash = crypto
							.createHash('md5')
							.update(`${photo.id}|${photo.owner_id}`)
							.digest('hex')
						let x1 = hash + '@1x.jpg'
						let x2 = hash + '@2x.jpg'
						let hashFile = md5File.sync(path)

						let dataFilesVK = await database.query('SELECT count(*) as count FROM vk_files WHERE md5 = ?', hashFile)

						let color = null
						let reversing = null

						if (dataFilesVK[0].count < 1) {
							if (!fs.existsSync(mainPath)) {
								fs.mkdirSync(mainPath)
							}
							await applySmartCrop(path, `${mainPath}/${hash}200.jpg`, 200, 200)
							await applySmartCrop(path, `${mainPath}/${x1}`, 600, 600)
							await applySmartCrop(path, `${mainPath}/${x2}`, 1200, 1200)

							await Sleep(2000)
							await getImageSize(`${mainPath}/${x1}`)

							await imagesMinify(`${mainPath}/${x1}`, `${mainPath}/`)
							await imagesMinify(`${mainPath}/${x2}`, `${mainPath}/`)
							await imagesMinify(`${mainPath}/${hash}200.jpg`, `${mainPath}/`)
							
							color = await getMediumColor(`${mainPath}/${x1}`)
							reversing = (await changeColor(color)) ? 'lighten' : 'darken'
							color = await rgbToHex(color)
							md5FilesVK.push(hashFile)
						}

						let fotos = []
						let i = 0
						for await (let attachment of attachments) {
							let photo = attachment.photo
							let path = await saveFoto(item, photo.sizes[photo.sizes.length - 1].url)
							let hash = crypto
								.createHash('md5')
								.update(`${photo.id}|${photo.owner_id}`)
								.digest('hex')

							let hashFile = md5File.sync(path)
							let dataFilesVK = await database.query('SELECT count(*) as count FROM vk_files WHERE md5 = ?', hashFile)
							if (dataFilesVK[0].count < 1) {
								if (!fs.existsSync(mainPath)) {
									fs.mkdirSync(mainPath)
								}
								await ImageResize(path, 1110, `${mainPath}/${hash}1140.jpg`)
								fs.copyFileSync(path, `${mainPath}/${hash}.jpg`)
								await imagesMinify(`${mainPath}/${hash}1140.jpg`, `${mainPath}/`)
								await imagesMinify(`${mainPath}/${hash}.jpg`, `${mainPath}/`)

								md5FilesVK.push(hashFile)
							}

							fotos.push({
								standart: `${dayPath}/${hash}1140.jpg`,
								original: `${dayPath}/${hash}.jpg`
							})

							i++
						}

						items_vk.push({
							id: item.id,
							text: item.text,
							cover: [dayPath + '/' + x1, dayPath + '/' + x2],
							fotos: fotos,
							date_str: date.format('LL'),
							date: item.date,
							color: color,
							reversing: reversing
						})
						console.log(item.id)
					}
				}
			}
		}
		items_vk.sort((t1, t2) => t1.date - t2.date)

		for await (let item of items_vk) {
			let data = await database.query('SELECT id FROM news WHERE JSON_EXTRACT(params, "$.vk_id") = ?', item.id)
			let id = null
			if (data.length < 1) {
				let result = await database.query('INSERT INTO `news` (`content`,`cover`,`photos`,`params`,`created_at`) VALUES (?, ?, ?, ?,?)', [
					item.text,
					JSON.stringify(item.cover),
					JSON.stringify(item.fotos),
					JSON.stringify({
						vk_id: item.id
					}),
					moment(item.date * 1000).format('YYYY-MM-DD HH:mm:ss')
				])

				id = result.insertId
			} else {
				id = data[0].id
				await database.query('UPDATE `news` SET `content` = ?,`cover` = ?,`photos` = ? WHERE id = ?', [item.text, JSON.stringify(item.cover), JSON.stringify(item.fotos), id])
			}

			if (!(isNull(item.color) && isNull(item.reversing))) {
				await database.query('UPDATE `news` SET `color` = ?,`reversing` = ? WHERE id = ?', [item.color, item.reversing, id])
			}
		}

		for await (let md5 of md5FilesVK) {
			await database.query('INSERT INTO `vk_files` (`md5`) VALUES (?)', md5)
		}
		console.log('👍')
		clearInterval(databaseInterval)
		database.close()
	} catch (e) {
		clearInterval(databaseInterval)
		database.close()
		console.error('💩', e) //
	}
}

Start()
