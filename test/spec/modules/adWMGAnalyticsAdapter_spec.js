import adWMGAnalyticsAdapter from 'modules/adWMGAnalyticsAdapter.js';
import { expect } from 'chai';
import { server } from 'test/mocks/xhr.js';
import {expectEvents} from '../../helpers/analytics.js';
import {EVENTS} from 'src/constants.js';
const adapterManager = require('src/adapterManager').default;
const events = require('src/events');

describe('adWMG Analytics', function () {
  const timestamp = new Date() - 256;
  const auctionId = '5018eb39-f900-4370-b71e-3bb5b48d324f';
  const timeout = 1500;

  const bidTimeoutArgs = [
    {
      bidId: '2baa51527bd015',
      bidder: 'bidderA',
      adUnitCode: '/19968336/header-bid-tag-0',
      auctionId: '66529d4c-8998-47c2-ab3e-5b953490b98f'
    },
    {
      bidId: '6fe3b4c2c23092',
      bidder: 'bidderB',
      adUnitCode: '/19968336/header-bid-tag-0',
      auctionId: '66529d4c-8998-47c2-ab3e-5b953490b98f'
    }
  ];

  const bidResponse = {
    bidderCode: 'bidderA',
    adId: '208750227436c1',
    mediaTypes: ['banner'],
    cpm: 0.015,
    auctionId: auctionId,
    responseTimestamp: 1509369418832,
    requestTimestamp: 1509369418389,
    bidder: 'bidderA',
    timeToRespond: 443,
    size: '300x250',
    width: 300,
    height: 250,
  };

  const wonRequest = {
    'adId': '4587fec4900b81',
    'mediaType': 'banner',
    'requestId': '4587fec4900b81',
    'cpm': 1.962,
    'creativeId': 2126,
    'currency': 'USD',
    'netRevenue': true,
    'ttl': 302,
    'auctionId': '914bedad-b145-4e46-ba58-51365faea6cb',
    'statusMessage': 'Bid available',
    'responseTimestamp': 1530628534437,
    'requestTimestamp': 1530628534219,
    'bidder': 'bidderB',
    'adUnitCode': 'div-gpt-ad-1438287399331-0',
    'sizes': [[300, 250]],
    'size': [300, 250],
  };

  const expectedBidWonData = {
    publisher_id: '5abd0543ba45723db49d97ea',
    site: 'test.com',
    ad_unit_size: ['300,250'],
    ad_unit_type: ['banner'],
    c_timeout: 1500,
    events: [
      {
        status: 'bidWon',
        bids: [
          {
            bidder: 'bidderB',
            auction_id: '914bedad-b145-4e46-ba58-51365faea6cb',
            ad_unit_code: 'div-gpt-ad-1438287399331-0',
            transaction_id: '',
            bid_size: ['300,250'],
            bid_type: ['banner'],
            time_ms: 256,
            cur: 'USD',
            price: '1.96',
            cur_native: '',
            price_native: ''
          }
        ]
      }
    ]
  }

  const adUnits = [{
    code: 'ad-slot-1',
    sizes: [[300, 250]],
    mediaTypes: {
      banner: {
        sizes: [[300, 250]]
      }
    },
    bids: [
      {
        bidder: 'bidderA',
        params: {
          placement: '1000'
        }
      },
      {
        bidder: 'bidderB',
        params: {
          placement: '56656'
        }
      }
    ]
  }];

  after(function () {
    adWMGAnalyticsAdapter.disableAnalytics();
  });

  describe('main test flow', function () {
    beforeEach(function () {
      sinon.stub(events, 'getEvents').returns([]);
    });

    afterEach(function () {
      events.getEvents.restore();
    });

    it('should catch all events', function () {
      sinon.spy(adWMGAnalyticsAdapter, 'track');

      adapterManager.registerAnalyticsAdapter({
        code: 'adWMG',
        adapter: adWMGAnalyticsAdapter
      });

      adapterManager.enableAnalytics({
        provider: 'adWMG',
        options: {
          site: 'test.com',
          publisher_id: '5abd0543ba45723db49d97ea'
        }
      });

      expectEvents([
        [EVENTS.AUCTION_INIT, {timestamp, auctionId, timeout, adUnits}],
        [EVENTS.BID_REQUESTED, {}],
        [EVENTS.BID_RESPONSE, bidResponse],
        [EVENTS.NO_BID, {}],
        [EVENTS.BID_TIMEOUT, bidTimeoutArgs],
        [EVENTS.AUCTION_END, {}],
        [EVENTS.BID_WON, wonRequest],
      ]).to.beTrackedBy(adWMGAnalyticsAdapter.track);
    });

    it('should be two xhr requests', function () {
      events.emit(EVENTS.AUCTION_END, {});
      events.emit(EVENTS.BID_WON, wonRequest);
      expect(server.requests.length).to.equal(2);
    });

    it('second request should be bidWon', function () {
      events.emit(EVENTS.AUCTION_END, {});
      events.emit(EVENTS.BID_WON, wonRequest);
      expect(JSON.parse(server.requests[1].requestBody).events[0].status).to.equal(expectedBidWonData.events[0].status);
    });

    it('check bidWon data', function () {
      events.emit(EVENTS.AUCTION_END, {});
      events.emit(EVENTS.BID_WON, wonRequest);
      const realBidWonData = JSON.parse(server.requests[1].requestBody);
      expect(realBidWonData.publisher_id).to.equal(expectedBidWonData.publisher_id);
      expect(realBidWonData.site).to.equal(expectedBidWonData.site);
      expect(realBidWonData.ad_unit_type[0]).to.equal(expectedBidWonData.ad_unit_type[0]);
      expect(realBidWonData.ad_unit_size[0]).to.equal(expectedBidWonData.ad_unit_size[0]);
      expect(realBidWonData.events[0].bids[0].bidder).to.equal(expectedBidWonData.events[0].bids[0].bidder);
    });
  });
});
