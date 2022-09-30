import { BehaviorSubject, filter, Observable, Subject, Subscription, takeUntil } from "rxjs";
import { HcpPacketHelper } from "./HcpPacketHelper";
import { HcpConnectionStatus, HcpPacket } from "./types";

const DEBUG = false;

export class HcpClientSocket {
    private webSocket_: WebSocket | null = null;

    private subscription_: Subscription | null = null;

    private connectionStatus$ = new BehaviorSubject<HcpConnectionStatus>("DISCONNECTED");

    private destroyTrigger$ = new Subject<any>();

    private message$ = new Subject<HcpPacket>();

    private textEncoder_?: TextEncoder;

    constructor(private address: string | URL) {}

    isConnected = (): boolean => this.connectionStatus$.value === "CONNECTED";

    observeConnectionStatus = (): Observable<HcpConnectionStatus> => {
        return this.connectionStatus$.asObservable();
    };

    observeHcpMessage = (): Observable<HcpPacket> => {
        return this.message$.asObservable();
    };

    start = () => {
        if (this.webSocket_) {
            throw new Error("client already started");
        }
        const s = new WebSocket(this.address);
        s.binaryType = "arraybuffer";
        s.addEventListener("open", this.onOpen_);
        s.addEventListener("message", this.onMessage_);
        s.addEventListener("close", this.onClose_);
        s.addEventListener("error", this.onError_);

        this.webSocket_ = s;
        this.connectionStatus$.next("CONNECTING");
        this.subscription_ = this.message$.asObservable().subscribe(this.onReceiveHcpMessage_);
    };

    private onOpen_ = (_ev: Event) => {
        this.connectionStatus$.next("PREPARING");
        this.send(HcpPacketHelper.createHelloPacket());
    };

    private onMessage_ = (event: MessageEvent<ArrayBuffer>) => {
        const data = event.data;
        const buf = new Uint8Array(data);

        const msg = HcpPacketHelper.parseBuffer(buf);
        if (msg) {
            if (DEBUG) console.log("onMessage_", msg.toString());
            this.message$.next(msg);
        }
    };

    private onError_ = (event: Event) => {
        if (DEBUG) console.log("onError_", event);
    };

    private onClose_ = (reason: CloseEvent) => {
        if (DEBUG) console.log("onClose_", reason);
        this.stop();
    };

    private onReceiveHcpMessage_ = (msg: HcpPacket) => {
        const channelId = msg.channelId();
        const channelMsg = msg.proc();
        if (channelId === "meta" && channelMsg === "welcome") {
            if (this.connectionStatus$.value === "PREPARING") {
                this.connectionStatus$.next("CONNECTED");
            } else {
                console.warn("connection status invalid:" + this.connectionStatus$.value);
            }
        }
    };

    private observeMsg_ = (): Observable<HcpPacket> => {
        return this.message$.pipe(takeUntil(this.destroyTrigger$));
    };

    private encode_ = (text: string): Uint8Array => {
        if (!this.textEncoder_) {
            this.textEncoder_ = new TextEncoder();
        }
        return this.textEncoder_.encode(text);
    };

    observeResponseByChannelMsg = (channelId: string, channelMsg: string): Observable<HcpPacket> => {
        return this.observeMsg_().pipe(filter((msg) => msg.channelId() === channelId && msg.proc() === channelMsg));
    };

    observeResponseByChannel = (channel: string): Observable<HcpPacket> => {
        return this.observeMsg_().pipe(filter((msg) => msg.channelId() === channel));
    };

    observeResponseByRequestId = (requestId: string): Observable<HcpPacket> => {
        return this.observeMsg_().pipe(filter((msg) => msg.requestId() === requestId));
    };

    send = (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
        const s = this.webSocket_;
        if (!s) {
            if (DEBUG) console.warn("send() fail, socket closed");
            return;
        }
        if (typeof data === "string") {
            s.send(this.encode_(data));
        } else {
            s.send(data);
        }
    };

    stop = () => {
        if (DEBUG) console.log("HcpClientSocket.stop()");
        this.destroyTrigger$.next(1); // emit any value

        if (this.connectionStatus$.value !== "DISCONNECTED") {
            this.connectionStatus$.next("DISCONNECTED");
        }

        if (this.subscription_) {
            this.subscription_.unsubscribe();
            this.subscription_ = null;
        }

        const s = this.webSocket_;
        if (s) {
            s.removeEventListener("open", this.onOpen_);
            s.removeEventListener("message", this.onMessage_);
            s.removeEventListener("close", this.onClose_);
            s.removeEventListener("error", this.onError_);
            s.close();
            this.webSocket_ = null;
        }
    };
}
