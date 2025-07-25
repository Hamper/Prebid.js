import { logMessage } from '../src/utils.js';
import {ajax} from '../src/ajax.js';
import adapter from '../libraries/analyticsAdapter/AnalyticsAdapter.js';
import { EVENTS } from '../src/constants.js';
import adapterManager from '../src/adapterManager.js';

const analyticsType = 'endpoint';

// We only want to send about 1% of events for sampling purposes
const SAMPLE_RATE_PERCENTAGE = 1 / 100;
const pageIncludedInSample = sampleAnalytics();

const url = 'https://bids.concert.io/analytics';

const {
  BID_RESPONSE,
  BID_WON,
  AUCTION_END
} = EVENTS;

let queue = [];

const concertAnalytics = Object.assign(adapter({url, analyticsType}), {
  track({ eventType, args }) {
    switch (eventType) {
      case BID_RESPONSE:
        if (args.bidder !== 'concert') break;
        queue.push(mapBidEvent(eventType, args));
        break;

      case BID_WON:
        if (args.bidder !== 'concert') break;
        queue.push(mapBidEvent(eventType, args));
        break;

      case AUCTION_END:
        // Set a delay, as BID_WON events will come after AUCTION_END events
        setTimeout(() => sendEvents(), 3000);
        break;

      default:
        break;
    }
  }
});

function mapBidEvent(eventType, args) {
  const { adId, auctionId, cpm, creativeId, width, height, timeToRespond } = args;
  const [gamCreativeId, concertRequestId] = getConcertRequestId(creativeId);

  const payload = {
    event: eventType,
    concert_rid: concertRequestId,
    adId,
    auctionId,
    creativeId: gamCreativeId,
    position: args.adUnitCode,
    url: window.location.href,
    cpm,
    width,
    height,
    timeToRespond
  }

  return payload;
}

/**
 * In order to pass back the concert_rid from CBS, it is tucked into the `creativeId`
 * slot in the bid response and combined with a pipe `|`. This method splits the creative ID
 * and the concert_rid.
 *
 * @param {string} creativeId
 */
function getConcertRequestId(creativeId) {
  if (!creativeId || creativeId.indexOf('|') < 0) return [null, null];

  return creativeId.split('|');
}

function sampleAnalytics() {
  return Math.random() <= SAMPLE_RATE_PERCENTAGE;
}

function sendEvents() {
  concertAnalytics.eventsStorage = queue;

  if (!queue.length) return;

  if (!pageIncludedInSample) {
    logMessage('Page not included in sample for Concert Analytics');
    return;
  }

  try {
    const body = JSON.stringify(queue);
    ajax(url, () => {
      queue = [];
    }, body, {
      contentType: 'application/json',
      method: 'POST'
    });
  } catch (err) { logMessage('Concert Analytics error') }
}

// save the base class function
concertAnalytics.originEnableAnalytics = concertAnalytics.enableAnalytics;
concertAnalytics.eventsStorage = [];

// override enableAnalytics so we can get access to the config passed in from the page
concertAnalytics.enableAnalytics = function (config) {
  concertAnalytics.originEnableAnalytics(config);
};

adapterManager.registerAnalyticsAdapter({
  adapter: concertAnalytics,
  code: 'concert'
});

export default concertAnalytics;
