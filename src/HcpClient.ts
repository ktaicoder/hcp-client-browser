import { filter, firstValueFrom, Observable, Subscription, take, timeout } from "rxjs";
import { HcpClientSocket } from "./HcpClientSocket";
import { HcpConnectionStatus, HcpPacket } from "./types";
import { HcpPacketHelper } from "./HcpPacketHelper";
import { genId } from "./gen-id";

const nextRequestId = () => genId("req");

const REQUEST_TIMEOUT = 7000;

export class HcpClient {
    private sock_: HcpClientSocket;

    private subscription_?: Subscription = undefined;

    constructor(address: string | URL) {
        this.sock_ = new HcpClientSocket(address);
    }

    observeConnectionStatus = (): Observable<HcpConnectionStatus> => this.sock_.observeConnectionStatus();

    isConnected = (): boolean => this.sock_.isConnected();

    waitForConnected = async (): Promise<void> => {
        await firstValueFrom(
            this.observeConnectionStatus() //
                .pipe(
                    filter((it) => it === "connected"),
                    take(1)
                )
        );
    };

    connect = () => {
        if (this.sock_.isConnected()) {
            throw new Error("client already started");
        }
        const s = this.sock_;
        this.subscription_ = new Subscription();
        this.subscription_.add(s.observeConnectionStatus().subscribe(this.debugConnectionStatus_));
        this.subscription_.add(s.observeHcpMessage().subscribe(this.debugHcpPacket_));
        s.start();
    };

    private debugConnectionStatus_ = (status: HcpConnectionStatus) => {
        console.log("HcpClient.debugConnectionStatus_() " + status);
    };

    private debugHcpPacket_ = (msg: HcpPacket) => {
        console.log("HcpClient.debugHcpPacket_() " + msg.channelId() + "," + msg.proc());
    };

    requestHwControl = async (hwCmd: string, ...args: unknown[]): Promise<HcpPacket> => {
        const requestId = nextRequestId();
        const [hwId, cmd] = hwCmd.split(".");
        if (!hwId || !cmd) {
            throw new Error("unknown");
        }
        // create packet
        const packet = HcpPacketHelper.createJsonPacket("hw,control", {
            header: {
                hwId,
                requestId,
            },
            body: {
                hwId,
                cmd,
                args,
            },
        });

        // send packet
        this.sock_.send(packet);

        // wait for response
        return firstValueFrom(
            this.sock_
                .observeResponseByRequestId(requestId) //
                .pipe(timeout({ first: REQUEST_TIMEOUT }))
        );
    };

    requestMetaCmd = async (cmd: string, ...args: unknown[]): Promise<HcpPacket> => {
        const requestId = nextRequestId();

        const packet = HcpPacketHelper.createJsonPacket("meta,cmd", {
            header: {
                requestId,
            },
            body: {
                cmd,
                args,
            },
        });

        // send packet
        this.sock_.send(packet);

        // wait for response
        return firstValueFrom(
            this.sock_
                .observeResponseByRequestId(requestId) //
                .pipe(timeout({ first: REQUEST_TIMEOUT }))
        );
    };

    close = () => {
        console.log("HcpClient.close()");
        this.sock_.stop();
        this.subscription_?.unsubscribe();
        this.subscription_ = undefined;
    };
}
