import { HcpClient } from "../build/es/index.js"

const HOST = "192.168.114.96"
const PORT = 13997

async function sleep(milli) {
    await new Promise((resolve) => setTimeout(resolve, milli))
}

async function main() {
    const requestElem = document.getElementById("request")
    const responseElem = document.getElementById("response")
    const statusElem = document.getElementById("status")

    function updateRequest_(msg) {
        requestElem.innerText = msg
    }

    function updateResponse_(msg) {
        responseElem.innerText = msg
    }

    function updateStatus_(msg) {
        statusElem.innerText = msg
    }

    updateRequest_(`connecting ws://${HOST}:${PORT}`)
    const client = new HcpClient(`ws://${HOST}:${PORT}`)
    client.observeConnectionStatus().subscribe((status) => {
        updateStatus_(`status changed: ${status}`)
    })

    client.connect()
    updateRequest_("client started, wait for connecting...")
    await client.waitForConnected()

    updateRequest_("wiseXboard.digitalWrite 1 1")
    let response = await client.requestHwControl("wiseXboard.digitalWrite", 1, 1)
    updateResponse_(response)
    await sleep(1000)

    updateRequest_(JSON.stringify(response))
    response = await client.requestMetaCmd("info", 1, 1)
    updateResponse_(response)
    await sleep(1000)

    while (true) {
        updateRequest_("wiseXboard.digitalWrite 1 1")
        response = await client.requestHwControl("wiseXboard.digitalWrite", 1, 1)
        updateResponse_(response)
        await sleep(1000)

        updateRequest_("wiseXboard.digitalWrite 1 0")
        response = await client.requestHwControl("wiseXboard.digitalWrite", 1, 0)
        updateResponse_(response)
        await sleep(1000)
    }
}

main()
