import { startFlow } from 'lighthouse'
import puppeteer, { Page } from 'puppeteer'
import * as util from '../util/util.js'
import { sendMsg } from '../util/slack.js'
import { generateTestReport, writeAggregatedMetrics } from '../util/reporting.js'
import { MainPage } from '../page/main-page.js'
import { flow } from '../../test.js'

export let flowConfig
let testResult = { steps: [] }
let aggregatedSessionResult = { steps: [] }
const desktopFlowConfig = util.parseJsonIntoObj(`${process.cwd()}/resources/desktop-flow-config.json`)
const mobileFlowConfig = util.parseJsonIntoObj(`${process.cwd()}/resources/mobile-flow-config.json`)
const browserOptions = util.parseJsonIntoObj(`${process.cwd()}/resources/browser-options.json`)
browserOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH

export async function startBrowser(url) {
    const browser = await puppeteer.launch(browserOptions)
    const page = await browser.newPage()
    await page.goto(url)
    return page
}

export async function startLhFlowOpenMainPage() {
    let page
    let flow
    let message

    try {
        page = await startBrowser(`${process.env.BASE_URL}`)
    } catch (error) {
        message = `Failed to launch browser - ${error}`
        console.log(message)
        await sendMsg(message)
    }
    try {
        switch (process.env.PLATFORM) {
            case "desktop": flowConfig = desktopFlowConfig
                setViewport(page, flowConfig)
                break;
            case "mobile": flowConfig = mobileFlowConfig
                setViewport(page, flowConfig)
                break;
            default:
                flowConfig = desktopFlowConfig
                process.env.PLATFORM = 'desktop'
                break;
        }
        flow = await startFlow(page, flowConfig)
        console.log('Session started.')
    } catch (error) {
        message = `Failed to start LH flow - ${error}`
        console.log(message)
        await sendMsg(message)
    }
    return new MainPage(flow)
}

export async function endSession() {
    const result = await flow.createFlowResult()
    const {steps} = result
    steps.forEach(step => {
        aggregatedSessionResult.steps.push(step)
        testResult.steps.push(step)
    });
    await flow._page.browser().close()
    console.log('Session closed.')
    await writeAggregatedMetrics(aggregatedSessionResult)
    aggregatedSessionResult = { steps: [] }
}

export async function endTest() {
    await generateTestReport(testResult)
}

/**
 * 
 * @param {Page} page 
 */
async function setViewport(page, flowConfig) {
    const { width } = flowConfig.config.settings.screenEmulation
    const { height } = flowConfig.config.settings.screenEmulation
    page.setViewport({ width, height })
}