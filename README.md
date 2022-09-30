# Hcp client browser

- HCP 클라이언트 라이브러리 입니다. 브라우저에서 사용합니다.

## 설치

```
$  yarn add @ktaicoder/hcp-client-browser
```

## example

대략 다음과 같이 작성할 수 있습니다.
완전한 코드는 `example/app.js` 파일을 참고하세요.

```js

async function main() {
    const client = new HcpClient(`ws://127.0.0.1:13997`)
    client.observeConnectionStatus().subscribe((status) => {
        // "disconnected" | "connecting" | "preparing" | "connected"
        console.log(`status changed: ${status}`)
    })

    client.connect()
    await client.waitForConnected()
    const response = await client.requestHwControl("wiseXboard.digitalWrite", 1, 1)
    // response is HcpPacket object
}
```
