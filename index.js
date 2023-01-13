import fs from 'fs'
import RSSParser from 'rss-parser'
import posters from './lib/posters/index.js'

const echoPath = process.argv[1].replace('index.js', '')

import config from './config.js'

const args = process.argv.slice(2)
const INIT_MODE = args.includes('init')
const DRY_MODE = args.includes('dry')

if (DRY_MODE && INIT_MODE)
{
    console.log('🚨 You cannot run Echo with init mode AND dry mode enabled at the same time')
    process.exit()
}

if (DRY_MODE) console.log('🌵 Running in dry mode, no posts will be created')

async function getFeedItems(feed)
{
    const data = await (new RSSParser()).parseURL(feed)
    return data.items
}

if (!fs.existsSync(`${echoPath}data`)) {
    fs.mkdirSync(`${echoPath}data`)
    console.log('📁 Data folder created!')
}

for (const site of config.sites)
{
    const siteFile = `${site.name}.txt`
    if (!fs.existsSync(`${echoPath}data/${siteFile}`)) {
        await fs.writeFile(`${echoPath}data/${siteFile}`, '', { flag: "wx" }, (err) => {
            if (err) throw err;
            console.log(`✅ ${site.name} data file created!`)
        })
    }

    console.log(`⚙️ Fetching for ${site.name}`)
    let items = await getFeedItems(site.feed)
    if (site.transform.filter)
    {
        items = site.transform.filter(items)
    }
    const data = await fs.promises.readFile(`${echoPath}data/${siteFile}`, 'utf8')
    const latestId = (data.split('\n') || []).filter(l => l)[0];
    if (latestId) {
        items.every((item, index) => {
            const itemId = site.transform.getId(item)
            if (itemId === latestId)
            {
                items = items.slice(0, index)
                return false
            }
            return true
        })
    }

    if (!items.length)
    {
        console.log(`❎ No new items found for ${site.name}`)
        continue
    }

    if (!DRY_MODE)
    {
        await fs.promises.writeFile(`${echoPath}data/${siteFile}`, site.transform.getId(items[0]));
    }

    if (INIT_MODE)
    {
        console.log('⚙️ Echo initialised!')
        continue
    }

    for (const item of items)
    {
        const formatted = site.transform.format(item)

        if (DRY_MODE)
        {
            console.log(`☑️ Will create ${site.name} post for ${formatted.date} - ${formatted.content}`)
        } else {
            for (const service of site.services)
            {
                await posters[service](config.services[service], formatted, site)
            }
        }
    }
}

process.exit()
