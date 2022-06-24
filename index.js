const puppeteer = require("puppeteer")
const express = require("express")
const AWS = require('aws-sdk')
const uuid = require('uuid');

const createBrowser = async () => {
    return await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    })
}

const createBlankPage = async (browser) => {
    const page = await browser.newPage()
    page.setJavaScriptEnabled(true)
    return page
}

const generatePDF = async (page, html, options) => {
    await page.setContent(html)
    return await page.pdf(options)
}

const generatePDFWithHTMLContent = (page) => {
    return (req, res) => {
        if (!req.body.html) {
            return res.status(400).send({ "error": "HTML content is required" })
        }
        const options = req.body.options || { format: "a4" }
        return generateAndSendPDF(page, req.body.html, options, res)
    }
}

const generateAndSendPDF = async (page, html, options, res) => {
    try {
        const s3 = new AWS.S3({
            accessKeyId: 'todo',
            secretAccessKey: 'todo',
            region: 'me-south-1'
        })

        const pdf = await generatePDF(page, html, options)
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Length", pdf.length)

        const uploadedImage = await s3.upload({
            Bucket: 'cdn.salamwaddah.com',
            Key: 'pdf/'+uuid.v4() + '.pdf',
            Body: pdf,
        }).promise()

        return res.send(uploadedImage.Location)
    } catch (err) {
        console.error(err)
        return res.status(500).send({ "error": "PDF could not generated" })
    }
}

// initialization
const init = async () => {
    const app = express()

    app.use(express.json({limit: '100mb'}))
    app.use(express.urlencoded({limit: '100mb', extended: true}));

    const browser = await createBrowser()
    const page = await createBlankPage(browser)

    app.post("/", generatePDFWithHTMLContent(page))

    app.listen(3000, () => console.log("Listening on port 3000"))
}
init()
    .then(() => console.log("Application started"))
    .catch(console.error)
