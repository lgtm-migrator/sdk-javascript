import { KuzzleEventEmitter } from "./core/KuzzleEventEmitter";
import { KuzzleAbstractProtocol } from "./protocols/abstract/Base";

import { AuthController } from "./controllers/Auth";
import { BulkController } from "./controllers/Bulk";
import { CollectionController } from "./controllers/Collection";
import { DocumentController } from "./controllers/Document";
import { IndexController } from "./controllers/Index";
import { RealtimeController } from "./controllers/Realtime";
import { ServerController } from "./controllers/Server";
import { SecurityController } from "./controllers/Security";
import { MemoryStorageController } from "./controllers/MemoryStorage";

import { Deprecation } from "./utils/Deprecation";
import { uuidv4 } from "./utils/uuidv4";
import { proxify } from "./utils/proxify";
import { debug } from "./utils/debug";
import { BaseRequest, JSONObject } from "./types";
import { RequestPayload } from "./types/RequestPayload";
import { ResponsePayload } from "./types/ResponsePayload";
import { RequestTimeoutError } from "./RequestTimeoutError";
import { BaseProtocolRealtime } from "./protocols/abstract/Realtime";

// Defined by webpack plugin
declare const SDKVERSION: any;

export class Kuzzle extends KuzzleEventEmitter {
  // We need to define any string key because users can register new controllers
  [key: string]: any;

  /**
   * Protocol used by the SDK to communicate with Kuzzle.
   */
  public protocol: any;

  /**
   * If true, automatically renews all subscriptions on a reconnected event.
   */
  public autoResubscribe: boolean;

  /**
   * Timeout before sending again a similar event.
   */
  public eventTimeout: number;

  /**
   * SDK version.
   */
  public sdkVersion: string;

  /**
   * SDK name (e.g: `js@7.4.2`).
   */
  public sdkName: string;

  /**
   * Common volatile data that will be sent to all future requests.
   */
  public volatile: JSONObject;

  /**
   * Handle deprecation warning in development mode (hidden in production)
   */
  public deprecationHandler: Deprecation;

  /**
   * Authenticator function called after a reconnection if the SDK is no longer
   * authenticated.
   */
  public authenticator: () => Promise<void> = null;

  /**
   * List of every events emitted by the SDK.
   */
  public events = [
    "callbackError",
    "connected",
    "discarded",
    "disconnected",
    "loginAttempt",
    "logoutAttempt",
    "networkError",
    "offlineQueuePush",
    "offlineQueuePop",
    "queryError",
    "reAuthenticated",
    "reconnected",
    "reconnectionError",
    "tokenExpired",
  ];

  public auth: AuthController;
  public bulk: any;
  public collection: CollectionController;
  public document: DocumentController;
  public index: IndexController;
  public ms: any;
  public realtime: RealtimeController;
  public security: SecurityController;
  public server: ServerController;

  private _protectedEvents: any;
  private _offlineQueue: any;
  private _autoQueue: any;
  private _autoReplay: any;
  private _offlineQueueLoader: any;
  private _queuing: boolean;
  private _queueFilter: any;
  private _queueMaxSize: any;
  private _queueTTL: any;
  private _replayInterval: any;
  private _requestTimeout: number;
  private _tokenExpiredInterval: any;
  private _lastTokenExpired: any;
  private _cookieAuthentication: boolean;
  private _reconnectInProgress: boolean;
  private _loggedIn: boolean;

  private __proxy__: any;

  /**
   * Instantiate a new SDK
   *
   * @example
   *
   * import { Kuzzle, WebSocket } from 'kuzzle-sdk';
   *
   * const kuzzle = new Kuzzle(
   *   new WebSocket('localhost')
   * );
   */
  constructor(
    /**
     * Network protocol to connect to Kuzzle. (e.g. `Http` or `WebSocket`)
     */
    protocol: KuzzleAbstractProtocol,
    options: {
      /**
       * Automatically renew all subscriptions on a `reconnected` event
       * Default: `true`
       */
      autoResubscribe?: boolean;
      /**
       * Time (in ms) during which a similar event is ignored
       * Default: `200`
       */
      eventTimeout?: number;
      /**
       * Common volatile data, will be sent to all future requests
       * Default: `{}`
       */
      volatile?: JSONObject;
      /**
       * If `true`, automatically queues all requests during offline mode
       * Default: `false`
       */
      autoQueue?: boolean;
      /**
       * If `true`, automatically replays queued requests
       * on a `reconnected` event
       * Default: `false`
       */
      autoReplay?: boolean;
      /**
       * Custom function called during offline mode to filter
       * queued requests on-the-fly
       */
      queueFilter?: (request: RequestPayload) => boolean;
      /**
       * Called before dequeuing requests after exiting offline mode,
       * to add items at the beginning of the offline queue
       */
      offlineQueueLoader?: (...any) => any;
      /**
       * Number of maximum requests kept during offline mode
       * Default: `500`
       */
      queueMaxSize?: number;
      /**
       * Time a queued request is kept during offline mode, in milliseconds
       * Default: `120000`
       */
      queueTTL?: number;
      /**
       * Delay between each replayed requests, in milliseconds
       * Default: `10`
       */
      replayInterval?: number;
      /**
       * Time (in ms) during which a request will still be waited to be resolved
       * Set it to `-1` if you want to wait indefinitely.
       * Default: `-1`
       */
      requestTimeout?: number;
      /**
       * Time (in ms) during which a TokenExpired event is ignored
       * Default: `1000`
       */
      tokenExpiredInterval?: number;
      /**
       * If set to `auto`, the `autoQueue` and `autoReplay` are also set to `true`
       */
      offlineMode?: "auto";
      /**
       * If `true` uses cookie to store token
       * Only supported in a browser
       * Default: `false`
       */
      cookieAuth?: boolean;
      /**
       * Show deprecation warning in development mode (hidden either way in production)
       * Default: `true`
       */
      deprecationWarning?: boolean;
    } = {}
  ) {
    super();

    if (protocol === undefined || protocol === null) {
      throw new Error('"protocol" argument missing');
    }

    // check the existence of required methods
    for (const method of ["addListener", "isReady", "query"]) {
      if (typeof protocol[method] !== "function") {
        throw new Error(
          `Protocol instance must implement a "${method}" method`
        );
      }
    }
    this.protocol = protocol;

    this._protectedEvents = {
      connected: {},
      disconnected: {},
      error: {},
      loginAttempt: {},
      reconnected: {},
      tokenExpired: {},
    };

    this.autoResubscribe =
      typeof options.autoResubscribe === "boolean"
        ? options.autoResubscribe
        : true;

    this.eventTimeout =
      typeof options.eventTimeout === "number" ? options.eventTimeout : 200;

    this.sdkVersion =
      typeof SDKVERSION === "undefined"
        ? // eslint-disable-next-line @typescript-eslint/no-var-requires
          require("../package").version
        : SDKVERSION;

    this.sdkName = `js@${this.sdkVersion}`;

    this.volatile =
      typeof options.volatile === "object" ? options.volatile : {};

    this._cookieAuthentication =
      typeof options.cookieAuth === "boolean" ? options.cookieAuth : false;

    if (this._cookieAuthentication) {
      this.protocol.enableCookieSupport();
      let autoQueueState;
      let autoReplayState;
      let autoResbuscribeState;

      this.protocol.addListener("websocketRenewalStart", () => {
        autoQueueState = this.autoQueue;
        autoReplayState = this.autoReplay;
        autoResbuscribeState = this.autoResubscribe;

        this.autoQueue = true;
        this.autoReplay = true;
        this.autoResubscribe = true;
      });

      this.protocol.addListener("websocketRenewalDone", () => {
        this.autoQueue = autoQueueState;
        this.autoReplay = autoReplayState;
        this.autoResubscribe = autoResbuscribeState;
      });
    }

    this.deprecationHandler = new Deprecation(
      typeof options.deprecationWarning === "boolean"
        ? options.deprecationWarning
        : true
    );

    if (this._cookieAuthentication && typeof XMLHttpRequest === "undefined") {
      throw new Error(
        "Support for cookie authentication with cookieAuth option is not supported outside a browser"
      );
    }

    // controllers
    this.useController(AuthController, "auth");
    this.useController(BulkController, "bulk");
    this.useController(CollectionController, "collection");
    this.useController(DocumentController, "document");
    this.useController(IndexController, "index");
    this.useController(MemoryStorageController, "ms");
    this.useController(RealtimeController, "realtime");
    this.useController(SecurityController, "security");
    this.useController(ServerController, "server");

    // offline queue
    this._offlineQueue = [];
    this._autoQueue =
      typeof options.autoQueue === "boolean" ? options.autoQueue : false;
    this._autoReplay =
      typeof options.autoReplay === "boolean" ? options.autoReplay : false;
    this._offlineQueueLoader =
      typeof options.offlineQueueLoader === "function"
        ? options.offlineQueueLoader
        : null;
    this._queueFilter =
      typeof options.queueFilter === "function" ? options.queueFilter : null;
    this._queueMaxSize =
      typeof options.queueMaxSize === "number" ? options.queueMaxSize : 500;
    this._queueTTL =
      typeof options.queueTTL === "number" ? options.queueTTL : 120000;
    this._replayInterval =
      typeof options.replayInterval === "number" ? options.replayInterval : 10;
    this._requestTimeout =
      typeof options.requestTimeout === "number" ? options.requestTimeout : -1;
    this._tokenExpiredInterval =
      typeof options.tokenExpiredInterval === "number"
        ? options.tokenExpiredInterval
        : 1000;

    if (options.offlineMode === "auto") {
      this._autoQueue = true;
      this._autoReplay = true;
    }
    this._queuing = false;

    this._lastTokenExpired = null;

    this._reconnectInProgress = false;

    this._loggedIn = false;

    this.on("loginAttempt", async (status) => {
      if (status.success) {
        this._loggedIn = true;
        return;
      }

      /**
       * In case of login failure we need to be sure that the stored token is still valid
       */
      try {
        this._loggedIn = await this.isAuthenticated();
      } catch {
        this._loggedIn = false;
      }
    });

    /**
     * When successfuly logged out
     */
    this.on("logoutAttempt", (status) => {
      if (status.success) {
        this._loggedIn = false;
      }
    });

    /**
     * On connection we need to verify if the token is still valid to know if we are still "logged in"
     */
    this.on("connected", async () => {
      try {
        this._loggedIn = await this.isAuthenticated();
      } catch {
        this._loggedIn = false;
      }
    });

    return proxify(this, {
      exposeApi: true,
      name: "kuzzle",
      seal: true,
    }) as Kuzzle;
  }

  /**
   * Returns `true` if the SDK holds a valid token
   */
  get authenticated() {
    return Boolean(
      this.auth.authenticationToken && !this.auth.authenticationToken.expired
    );
  }

  get autoQueue() {
    return this._autoQueue;
  }

  set autoQueue(value) {
    this._checkPropertyType("_autoQueue", "boolean", value);
    this._autoQueue = value;
  }

  get autoReconnect() {
    const protocol = this.protocol as BaseProtocolRealtime;
    return protocol.autoReconnect;
  }

  set autoReconnect(value) {
    this._checkPropertyType("autoReconnect", "boolean", value);
    const protocol = this.protocol as BaseProtocolRealtime;
    protocol.autoReconnect = value;
  }

  get autoReplay() {
    return this._autoReplay;
  }

  set autoReplay(value) {
    this._checkPropertyType("_autoReplay", "boolean", value);
    this._autoReplay = value;
  }

  /**
   * Returns `true` if the SDK is using the cookie authentication mode.
   * (Web only)
   */
  get cookieAuthentication() {
    return this._cookieAuthentication;
  }

  /**
   * Returns `true` if the SDK is currently connected to a Kuzzle server.
   */
  get connected() {
    return this.protocol.connected;
  }

  get host() {
    return this.protocol.host;
  }

  get jwt() {
    if (!this.auth.authenticationToken) {
      return null;
    }

    return this.auth.authenticationToken.encodedJwt;
  }

  set jwt(encodedJwt) {
    this.auth.authenticationToken = encodedJwt;

    this._loggedIn = encodedJwt ? true : false;
  }

  get offlineQueue() {
    return this._offlineQueue;
  }

  get offlineQueueLoader() {
    return this._offlineQueueLoader;
  }

  set offlineQueueLoader(value) {
    this._checkPropertyType("_offlineQueueLoader", "function", value);
    this._offlineQueueLoader = value;
  }

  get port() {
    return this.protocol.port;
  }

  get queueFilter() {
    return this._queueFilter;
  }

  set queueFilter(value) {
    this._checkPropertyType("_queueFilter", "function", value);
    this._queueFilter = value;
  }

  get queueMaxSize() {
    return this._queueMaxSize;
  }

  set queueMaxSize(value) {
    this._checkPropertyType("_queueMaxSize", "number", value);
    this._queueMaxSize = value;
  }

  get queueTTL() {
    return this._queueTTL;
  }

  set queueTTL(value) {
    this._checkPropertyType("_queueTTL", "number", value);
    this._queueTTL = value;
  }

  get reconnectionDelay() {
    const protocol = this.protocol as BaseProtocolRealtime;
    return protocol.reconnectionDelay;
  }

  get replayInterval() {
    return this._replayInterval;
  }

  set replayInterval(value) {
    this._checkPropertyType("_replayInterval", "number", value);
    this._replayInterval = value;
  }

  get requestTimeout() {
    return this._requestTimeout;
  }

  set requestTimeout(value) {
    this._checkPropertyType("_requestTimeout", "number", value);
    this._requestTimeout = value;
  }

  get sslConnection() {
    return this.protocol.sslConnection;
  }

  get tokenExpiredInterval() {
    return this._tokenExpiredInterval;
  }

  set tokenExpiredInterval(value) {
    this._checkPropertyType("_tokenExpiredInterval", "number", value);
    this._tokenExpiredInterval = value;
  }

  /**
   * Emit an event to all registered listeners
   * An event cannot be emitted multiple times before a timeout has been reached.
   */
  emit(eventName: string, ...payload) {
    const now = Date.now(),
      protectedEvent = this._protectedEvents[eventName];

    if (protectedEvent) {
      if (
        protectedEvent.lastEmitted &&
        protectedEvent.lastEmitted > now - this.eventTimeout
      ) {
        return false;
      }
      protectedEvent.lastEmitted = now;
    }

    return this._superEmit(eventName, ...payload);
  }

  private _superEmit(eventName, ...payload) {
    return super.emit(eventName, ...payload);
  }

  /**
   * Connects to a Kuzzle instance
   */
  connect(): Promise<void> {
    if (this.protocol.isReady()) {
      return Promise.resolve();
    }

    if (this.autoQueue) {
      this.startQueuing();
    }

    this.protocol.addListener("queryError", ({ error, request }) => {
      this.emit("queryError", { error, request });
    });

    this.protocol.addListener("tokenExpired", () => this.tokenExpired());

    this.protocol.addListener("connect", () => {
      if (this.autoQueue) {
        this.stopQueuing();
      }

      if (this.autoReplay) {
        this.playQueue();
      }

      this.emit("connected");
    });

    this.protocol.addListener("networkError", (error) => {
      if (this.autoQueue) {
        this.startQueuing();
      }
      this.emit("networkError", error);
    });

    this.protocol.addListener("disconnect", (context) => {
      this.emit("disconnected", context);
    });

    this.protocol.addListener("reconnect", this._reconnect.bind(this));

    this.protocol.addListener("discarded", (data) =>
      this.emit("discarded", data)
    );

    this.protocol.addListener("websocketRenewalStart", () => {
      this._reconnectInProgress = true;
    });
    this.protocol.addListener("websocketRenewalDone", () => {
      this._reconnectInProgress = false;
    });

    return this.protocol.connect();
  }

  async _reconnect() {
    if (this._reconnectInProgress) {
      return;
    }

    if (this.autoQueue) {
      this.stopQueuing();
    }

    // If an authenticator was set, check if a user was logged in and  if the token is still valid and try
    // to re-authenticate if needed. Otherwise the SDK is in disconnected state.
    if (this._loggedIn && !(await this.tryReAuthenticate())) {
      this._loggedIn = false;
      this.disconnect();

      return;
    }

    if (this.autoReplay) {
      this.playQueue();
    }

    this.emit("reconnected");
  }

  /**
   * Try to re-authenticate the SDK if the current token is invalid.
   *
   * If the token is invalid, this method will return false and emit a
   * "reconnectionError" event when:
   *   - the SDK cannot re-authenticate using the authenticator function
   *   - the authenticator function is not set
   *
   * This method never returns a rejected promise.
   */
  private async tryReAuthenticate(): Promise<boolean> {
    this._reconnectInProgress = true;
    try {
      const valid = await this.isAuthenticated();

      if (valid) {
        return true;
      }

      /**
       * Check if there is an authenticator after verifying if the token is still valid,
       * like so API Keys can be used even if there is no authenticator since they will be still valid.
       */
      if (!this.authenticator) {
        this.emit("reconnectionError", {
          error: new Error(
            'Could not re-authenticate: "authenticator" property is not set.'
          ),
        });
        return false;
      }

      await this.authenticate();

      return true;
    } catch (err) {
      this.emit("reconnectionError", {
        error: new Error(
          `Failed to authenticate the SDK after reconnection: ${err}`
        ),
      });

      return false;
    } finally {
      this._reconnectInProgress = false;
    }
  }

  /**
   * Use the "authenticator" function to authenticate the SDK.
   *
   * @returns The authentication token
   */
  async authenticate(): Promise<void> {
    if (typeof this.authenticator !== "function") {
      throw new Error('The "authenticator" property must be a function.');
    }

    await this.authenticator();

    const valid = await this.isAuthenticated();

    this._loggedIn = valid;

    if (!valid) {
      throw new Error(
        'The "authenticator" function failed to authenticate the SDK.'
      );
    }
  }

  /**
   * Check wether the user is authenticated or not
   * by verifiying if a token is present and still valid
   * and if the token doesn't belong to the anonymous user.
   */
  async isAuthenticated() {
    const { valid, kuid } = await this.auth.checkToken();

    return valid && kuid !== "-1";
  }

  /**
   * Adds a listener to a Kuzzle global event. When an event is fired, listeners are called in the order of their
   * insertion.
   *
   * @param {string} event - name of the global event to subscribe to
   * @param {function} listener - callback to invoke each time an event is fired
   */
  addListener(event, listener) {
    if (this.events.indexOf(event) === -1) {
      throw new Error(
        `[${event}] is not a known event. Known events: ${this.events.join(
          ", "
        )}`
      );
    }

    return this._superAddListener(event, listener);
  }

  private _superAddListener(event, listener) {
    return super.addListener(event, listener);
  }

  /**
   * Empties the offline queue without replaying it.
   *
   * @returns {Kuzzle}
   */
  flushQueue() {
    this._offlineQueue = [];
    return this;
  }

  /**
   * Disconnects from Kuzzle and invalidate this instance.
   */
  disconnect() {
    this._loggedIn = false;
    this.protocol.close();
  }

  /**
   * This is a low-level method, exposed to allow advanced SDK users to bypass
   * high-level methods.
   * Base method used to send read queries to Kuzzle
   *
   * Takes an optional argument object with the following properties:
   *    - volatile (object, default: null):
   *        Additional information passed to notifications to other users
   *
   * @param req
   * @param opts - Optional arguments
   */
  query<TRequest extends BaseRequest, TResult>(
    req: TRequest,
    opts: JSONObject = {}
  ): Promise<ResponsePayload<TResult>> {
    if (typeof req !== "object" || Array.isArray(req)) {
      throw new Error(`Kuzzle.query: Invalid request: ${JSON.stringify(req)}`);
    }

    if (typeof opts !== "object" || Array.isArray(opts)) {
      throw new Error(
        `Kuzzle.query: Invalid "options" argument: ${JSON.stringify(opts)}`
      );
    }

    const request = JSON.parse(JSON.stringify(req));
    const options = JSON.parse(JSON.stringify(opts));

    if (!request.requestId) {
      request.requestId = uuidv4();
    }

    let queuable = true;
    if (options && options.queuable === false) {
      queuable = false;
    }

    if (this.queueFilter) {
      queuable = queuable && this.queueFilter(request);
    }

    const requestTimeout =
      typeof options.timeout === "number"
        ? options.timeout
        : this._requestTimeout;

    for (const [key, value] of Object.entries(options)) {
      // Ignore common SDK option
      if (["queuable", "timeout"].includes(key)) {
        continue;
      }
      request[key] = value;
    }

    if (request.refresh === undefined && options.refresh !== undefined) {
      request.refresh = options.refresh;
    }

    if (
      request.retryOnConflict === undefined &&
      options.retryOnConflict !== undefined
    ) {
      request.retryOnConflict = options.retryOnConflict;
    }

    if (!request.volatile) {
      request.volatile = this.volatile;
    } else if (
      typeof request.volatile !== "object" ||
      Array.isArray(request.volatile)
    ) {
      throw new Error(
        `Kuzzle.query: Invalid volatile argument received: ${JSON.stringify(
          request.volatile
        )}`
      );
    }

    for (const item of Object.keys(this.volatile)) {
      if (request.volatile[item] === undefined) {
        request.volatile[item] = this.volatile[item];
      }
    }
    request.volatile.sdkInstanceId =
      request.volatile.sdkInstanceId || this.protocol.id;
    request.volatile.sdkName = request.volatile.sdkName || this.sdkName;

    this.auth.authenticateRequest(request);

    if (this._queuing) {
      if (queuable) {
        this._cleanQueue();

        this.emit("offlineQueuePush", { request });

        return new Promise((resolve, reject) => {
          this.offlineQueue.push({
            reject,
            request,
            resolve,
            timeout: requestTimeout,
            ts: Date.now(),
          });
        });
      }

      this.emit("discarded", { request });
      return Promise.reject(
        new Error(`Unable to execute request: not connected to a Kuzzle server.
Discarded request: ${JSON.stringify(request)}`)
      );
    }

    return this._timeoutRequest(requestTimeout, request, options).then(
      (response: ResponsePayload<TResult>) => {
        debug("RESPONSE", response);

        return this.deprecationHandler.logDeprecation(response);
      }
    );
  }

  /**
   * Starts the requests queuing.
   */
  startQueuing() {
    this._queuing = true;
    return this;
  }

  /**
   * Stops the requests queuing.
   */
  stopQueuing() {
    this._queuing = false;
    return this;
  }

  /**
   * Plays the requests queued during offline mode.
   */
  playQueue() {
    if (this.protocol.isReady()) {
      this._cleanQueue();
      this._dequeue();
    }
    return this;
  }

  /**
   * On token expiration, reset jwt and unsubscribe all rooms.
   * Throttles to avoid duplicate event triggers.
   */
  async tokenExpired() {
    if (this._reconnectInProgress) {
      return;
    }

    if (this._loggedIn && (await this.tryReAuthenticate())) {
      this.emit("reAuthenticated");

      return;
    }

    const now = Date.now();

    if (now - this._lastTokenExpired < this.tokenExpiredInterval) {
      // event was recently already fired
      return;
    }

    this._lastTokenExpired = now;

    this.jwt = null;
    this.emit("tokenExpired");
  }

  /**
   * Adds a new controller and make it available in the SDK.
   *
   * @param ControllerClass
   * @param accessor
   */
  useController(ControllerClass: any, accessor: string) {
    if (!(accessor && accessor.length > 0)) {
      throw new Error("You must provide a valid accessor.");
    }

    if (this.__proxy__ ? this.__proxy__.hasProp(accessor) : this[accessor]) {
      throw new Error(
        `There is already a controller with the accessor '${accessor}'. Please use another one.`
      );
    }

    const controller = new ControllerClass(this);

    if (!(controller.name && controller.name.length > 0)) {
      throw new Error("Controllers must have a name.");
    }

    if (controller.kuzzle !== this) {
      throw new Error(
        "You must pass the Kuzzle SDK instance to the parent constructor."
      );
    }

    if (this.__proxy__) {
      this.__proxy__.registerProp(accessor);
    }
    this[accessor] = controller;

    return this;
  }

  private _checkPropertyType(prop, typestr, value) {
    const wrongType =
      typestr === "array" ? !Array.isArray(value) : typeof value !== typestr;

    if (wrongType) {
      throw new Error(
        `Expected ${prop} to be a ${typestr}, ${typeof value} received`
      );
    }
  }

  /**
   * Clean up the queue, ensuring the queryTTL and queryMaxSize properties are respected
   */
  private _cleanQueue() {
    const now = Date.now();
    let lastDocumentIndex = -1;

    if (this.queueTTL > 0) {
      this.offlineQueue.forEach((query, index) => {
        if (query.ts < now - this.queueTTL) {
          lastDocumentIndex = index;
        }
      });

      if (lastDocumentIndex !== -1) {
        this.offlineQueue
          .splice(0, lastDocumentIndex + 1)
          .forEach((droppedRequest) => {
            this.emit("offlineQueuePop", droppedRequest.request);
            droppedRequest.reject(
              new Error(
                "Query aborted: queued time exceeded the queueTTL option value"
              )
            );
          });
      }
    }

    if (this.queueMaxSize > 0 && this.offlineQueue.length > this.queueMaxSize) {
      this.offlineQueue
        .splice(0, this.offlineQueue.length - this.queueMaxSize)
        .forEach((droppedRequest) => {
          this.emit("offlineQueuePop", droppedRequest.request);
          droppedRequest.reject(
            new Error(
              "Query aborted: too many queued requests (see the queueMaxSize option)"
            )
          );
        });
    }
  }

  /**
   * Play all queued requests, in order.
   */
  private _dequeue() {
    const uniqueQueue = {},
      dequeuingProcess = () => {
        if (this.offlineQueue.length > 0) {
          this._timeoutRequest(
            this.offlineQueue[0].timeout,
            this.offlineQueue[0].request
          )
            .then(this.offlineQueue[0].resolve)
            .catch(this.offlineQueue[0].reject);

          this.emit("offlineQueuePop", this.offlineQueue.shift().request);

          setTimeout(() => {
            dequeuingProcess();
          }, Math.max(0, this.replayInterval));
        }
      };

    if (this.offlineQueueLoader) {
      if (typeof this.offlineQueueLoader !== "function") {
        throw new Error(
          "Invalid value for offlineQueueLoader property. Expected: function. Got: " +
            typeof this.offlineQueueLoader
        );
      }

      return Promise.resolve()
        .then(() => this.offlineQueueLoader())
        .then((additionalQueue) => {
          if (Array.isArray(additionalQueue)) {
            this._offlineQueue = additionalQueue
              .concat(this.offlineQueue)
              .filter((query) => {
                // throws if the request does not contain required attributes
                if (
                  !query.request ||
                  query.request.requestId === undefined ||
                  !query.request.action ||
                  !query.request.controller
                ) {
                  throw new Error(
                    "Invalid offline queue request. One or more missing properties: requestId, action, controller."
                  );
                }

                return Object.prototype.hasOwnProperty.call(
                  uniqueQueue,
                  query.request.requestId
                )
                  ? false
                  : (uniqueQueue[query.request.requestId] = true);
              });

            dequeuingProcess();
          } else {
            throw new Error(
              "Invalid value returned by the offlineQueueLoader function. Expected: array. Got: " +
                typeof additionalQueue
            );
          }
        });
    }

    dequeuingProcess();
  }

  /**
   * Sends a request with a timeout
   *
   * @param delay Delay before the request is rejected if not resolved
   * @param request Request object
   * @param options Request options
   * @returns Resolved request or a TimedOutError
   */
  private _timeoutRequest(
    delay: number,
    request: RequestPayload,
    options: JSONObject = {}
  ) {
    debug("REQUEST", request);

    // No timeout
    if (delay === -1) {
      return this.protocol.query(request, options);
    }

    const timeout = new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new RequestTimeoutError(request, delay));
      }, delay);
    });

    return Promise.race([timeout, this.protocol.query(request, options)]);
  }
}
