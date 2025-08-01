import { deepClone, generateUUID, getParameterByName, hasNonSerializableProperty, logError, parseUrl, logInfo } from '../src/utils.js';
import {ajaxBuilder} from '../src/ajax.js';
import adapter from '../libraries/analyticsAdapter/AnalyticsAdapter.js';
import adapterManager from '../src/adapterManager.js';
import {getStorageManager} from '../src/storageManager.js';
import { EVENTS } from '../src/constants.js';
import {MODULE_TYPE_ANALYTICS} from '../src/activities/modules.js';
import { getViewportSize } from '../libraries/viewport/viewport.js';
import { collectUtmTagData, trimAdUnit, trimBid, trimBidderRequest } from '../libraries/asteriobidUtils/asteriobidUtils.js';

/**
 * prebidmanagerAnalyticsAdapter.js - analytics adapter for prebidmanager
 */
export const storage = getStorageManager({moduleType: MODULE_TYPE_ANALYTICS, moduleName: 'asteriobidpbm'});
const DEFAULT_EVENT_URL = 'https://endpt.prebidmanager.com/endpoint';
const analyticsType = 'endpoint';
const analyticsName = 'Asteriobid PBM Analytics';

const ajax = ajaxBuilder(0);

var _VERSION = 1;
var initOptions = null;
var _pageViewId = generateUUID();
var _startAuction = 0;
var _bidRequestTimeout = 0;
let flushInterval;
var pmAnalyticsEnabled = false;

const {width: x, height: y} = getViewportSize();

var _pageView = {
  eventType: 'pageView',
  userAgent: window.navigator.userAgent,
  timestamp: Date.now(),
  timezoneOffset: new Date().getTimezoneOffset(),
  language: window.navigator.language,
  vendor: window.navigator.vendor,
  screenWidth: x,
  screenHeight: y
};

var _eventQueue = [
  _pageView
];

const prebidmanagerAnalytics = Object.assign(adapter({url: DEFAULT_EVENT_URL, analyticsType}), {
  track({eventType, args}) {
    handleEvent(eventType, args);
  }
});

prebidmanagerAnalytics.originEnableAnalytics = prebidmanagerAnalytics.enableAnalytics;
prebidmanagerAnalytics.enableAnalytics = function (config) {
  initOptions = config.options || {};
  initOptions.url = initOptions.url || DEFAULT_EVENT_URL;
  initOptions.sampling = initOptions.sampling || 1;

  if (Math.floor(Math.random() * initOptions.sampling) === 0) {
    pmAnalyticsEnabled = true;
    flushInterval = setInterval(flush, 1000);
  } else {
    logInfo(`${analyticsName} isn't enabled because of sampling`);
  }

  prebidmanagerAnalytics.originEnableAnalytics(config);
};

prebidmanagerAnalytics.originDisableAnalytics = prebidmanagerAnalytics.disableAnalytics;
prebidmanagerAnalytics.disableAnalytics = function () {
  if (!pmAnalyticsEnabled) {
    return;
  }
  flush();
  clearInterval(flushInterval);
  prebidmanagerAnalytics.originDisableAnalytics();
};

function collectPageInfo() {
  const pageInfo = {
    domain: window.location.hostname,
  }
  if (document.referrer) {
    pageInfo.referrerDomain = parseUrl(document.referrer).hostname;
  }
  return pageInfo;
}

function flush() {
  if (!pmAnalyticsEnabled) {
    return;
  }

  if (_eventQueue.length > 1) {
    var data = {
      pageViewId: _pageViewId,
      ver: _VERSION,
      bundleId: initOptions.bundleId,
      events: _eventQueue,
      utmTags: collectUtmTagData(storage, getParameterByName, logError, analyticsName),
      pageInfo: collectPageInfo(),
    };

    if ('version' in initOptions) {
      data.version = initOptions.version;
    }
    if ('tcf_compliant' in initOptions) {
      data.tcf_compliant = initOptions.tcf_compliant;
    }
    if ('sampling' in initOptions) {
      data.sampling = initOptions.sampling;
    }

    ajax(
      initOptions.url,
      () => logInfo(`${analyticsName} sent events batch`),
      _VERSION + ':' + JSON.stringify(data),
      {
        contentType: 'text/plain',
        method: 'POST',
        withCredentials: true
      }
    );
    _eventQueue = [
      _pageView
    ];
  }
}

function handleEvent(eventType, eventArgs) {
  if (eventArgs) {
    eventArgs = hasNonSerializableProperty(eventArgs) ? eventArgs : deepClone(eventArgs)
  } else {
    eventArgs = {}
  }

  const pmEvent = {};

  switch (eventType) {
    case EVENTS.AUCTION_INIT: {
      pmEvent.auctionId = eventArgs.auctionId;
      pmEvent.timeout = eventArgs.timeout;
      pmEvent.eventType = eventArgs.eventType;
      pmEvent.adUnits = eventArgs.adUnits && eventArgs.adUnits.map(trimAdUnit)
      pmEvent.bidderRequests = eventArgs.bidderRequests && eventArgs.bidderRequests.map(trimBidderRequest)
      _startAuction = pmEvent.timestamp;
      _bidRequestTimeout = pmEvent.timeout;
      break;
    }
    case EVENTS.AUCTION_END: {
      pmEvent.auctionId = eventArgs.auctionId;
      pmEvent.end = eventArgs.end;
      pmEvent.start = eventArgs.start;
      pmEvent.adUnitCodes = eventArgs.adUnitCodes;
      pmEvent.bidsReceived = eventArgs.bidsReceived && eventArgs.bidsReceived.map(trimBid);
      pmEvent.start = _startAuction;
      pmEvent.end = Date.now();
      break;
    }
    case EVENTS.BID_ADJUSTMENT: {
      break;
    }
    case EVENTS.BID_TIMEOUT: {
      pmEvent.bidders = eventArgs && eventArgs.map ? eventArgs.map(trimBid) : eventArgs;
      pmEvent.duration = _bidRequestTimeout;
      break;
    }
    case EVENTS.BID_REQUESTED: {
      pmEvent.auctionId = eventArgs.auctionId;
      pmEvent.bidderCode = eventArgs.bidderCode;
      pmEvent.doneCbCallCount = eventArgs.doneCbCallCount;
      pmEvent.start = eventArgs.start;
      pmEvent.bidderRequestId = eventArgs.bidderRequestId;
      pmEvent.bids = eventArgs.bids && eventArgs.bids.map(trimBid);
      pmEvent.auctionStart = eventArgs.auctionStart;
      pmEvent.timeout = eventArgs.timeout;
      break;
    }
    case EVENTS.BID_RESPONSE: {
      pmEvent.bidderCode = eventArgs.bidderCode;
      pmEvent.width = eventArgs.width;
      pmEvent.height = eventArgs.height;
      pmEvent.adId = eventArgs.adId;
      pmEvent.mediaType = eventArgs.mediaType;
      pmEvent.cpm = eventArgs.cpm;
      pmEvent.currency = eventArgs.currency;
      pmEvent.requestId = eventArgs.requestId;
      pmEvent.adUnitCode = eventArgs.adUnitCode;
      pmEvent.auctionId = eventArgs.auctionId;
      pmEvent.timeToRespond = eventArgs.timeToRespond;
      pmEvent.responseTimestamp = eventArgs.responseTimestamp;
      pmEvent.requestTimestamp = eventArgs.requestTimestamp;
      pmEvent.netRevenue = eventArgs.netRevenue;
      pmEvent.size = eventArgs.size;
      pmEvent.adserverTargeting = eventArgs.adserverTargeting;
      break;
    }
    case EVENTS.BID_WON: {
      pmEvent.auctionId = eventArgs.auctionId;
      pmEvent.adId = eventArgs.adId;
      pmEvent.adserverTargeting = eventArgs.adserverTargeting;
      pmEvent.adUnitCode = eventArgs.adUnitCode;
      pmEvent.bidderCode = eventArgs.bidderCode;
      pmEvent.height = eventArgs.height;
      pmEvent.mediaType = eventArgs.mediaType;
      pmEvent.netRevenue = eventArgs.netRevenue;
      pmEvent.cpm = eventArgs.cpm;
      pmEvent.requestTimestamp = eventArgs.requestTimestamp;
      pmEvent.responseTimestamp = eventArgs.responseTimestamp;
      pmEvent.size = eventArgs.size;
      pmEvent.width = eventArgs.width;
      pmEvent.currency = eventArgs.currency;
      pmEvent.bidder = eventArgs.bidder;
      break;
    }
    case EVENTS.BIDDER_DONE: {
      pmEvent.auctionId = eventArgs.auctionId;
      pmEvent.auctionStart = eventArgs.auctionStart;
      pmEvent.bidderCode = eventArgs.bidderCode;
      pmEvent.bidderRequestId = eventArgs.bidderRequestId;
      pmEvent.bids = eventArgs.bids && eventArgs.bids.map(trimBid);
      pmEvent.doneCbCallCount = eventArgs.doneCbCallCount;
      pmEvent.start = eventArgs.start;
      pmEvent.timeout = eventArgs.timeout;
      pmEvent.tid = eventArgs.tid;
      pmEvent.src = eventArgs.src;
      break;
    }
    case EVENTS.SET_TARGETING: {
      break;
    }
    case EVENTS.REQUEST_BIDS: {
      break;
    }
    case EVENTS.ADD_AD_UNITS: {
      break;
    }
    case EVENTS.AD_RENDER_FAILED: {
      pmEvent.bid = eventArgs.bid;
      pmEvent.message = eventArgs.message;
      pmEvent.reason = eventArgs.reason;
      break;
    }
    default:
      return;
  }

  pmEvent.eventType = eventType;
  pmEvent.timestamp = pmEvent.timestamp || Date.now();

  sendEvent(pmEvent);
}

function sendEvent(event) {
  _eventQueue.push(event);
  logInfo(`${analyticsName} Event ${event.eventType}:`, event);

  if (event.eventType === EVENTS.AUCTION_END) {
    flush();
  }
}

adapterManager.registerAnalyticsAdapter({
  adapter: prebidmanagerAnalytics,
  code: 'prebidmanager'
});

prebidmanagerAnalytics.getOptions = function () {
  return initOptions;
};

prebidmanagerAnalytics.flush = flush;

export default prebidmanagerAnalytics;
