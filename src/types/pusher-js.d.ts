declare module 'pusher-js' {
  class Pusher {
    constructor(key: string, options: { cluster: string });
    subscribe(channelName: string): Channel;
    disconnect(): void;
  }

  interface Channel {
    bind(event: string, callback: (data: any) => void): void;
    unbind_all(): void;
    unsubscribe(): void;
  }

  export default Pusher;
}
