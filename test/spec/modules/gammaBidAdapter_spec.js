import { expect } from 'chai';
import { spec } from 'modules/gammaBidAdapter.js';
import { newBidder } from 'src/adapters/bidderFactory.js';

describe('gammaBidAdapter', function() {
  const adapter = newBidder(spec);

  const bid = {
    'bidder': 'gamma',
    'params': {
      siteId: '1398219351',
      zoneId: '1398219417',
      region: 'SGP'
    },
    'adUnitCode': 'adunit-code',
    'sizes': [
      [300, 250]
    ],
    'bidId': '23beaa6af6cdde',
    'bidderRequestId': '19c0c1efdf37e7',
    'auctionId': '61466567-d482-4a16-96f0-fe5f25ffbdf1',
  };
  const bidArray = [bid];

  describe('isBidRequestValid', () => {
    it('should return true when required params found', () => {
      expect(spec.isBidRequestValid(bid)).to.equal(true);
    });

    it('should return false when require params are not passed', () => {
      const invalidBid = Object.assign({}, bid);
      invalidBid.params = {};
      expect(spec.isBidRequestValid(invalidBid)).to.equal(false);
    });

    it('should return false when params not passed correctly', () => {
      bid.params.siteId = '';
      bid.params.zoneId = '';
      expect(spec.isBidRequestValid(bid)).to.equal(false);
    });
  });

  describe('buildRequests', () => {
    it('should attempt to send bid requests to the endpoint via GET', () => {
      const requests = spec.buildRequests(bidArray);
      requests.forEach(function(requestItem) {
        expect(requestItem.method).to.equal('GET');
        expect(requestItem.url).to.match(new RegExp(`hb.gammaplatform.com`));
      });
    });
  });

  describe('interpretResponse', () => {
    let serverResponse;

    beforeEach(() => {
      serverResponse = {
        body: {
          'id': '23beaa6af6cdde',
          'bid': '5611802021800040585',
          'type': 'banner',
          'cur': 'USD',
          'seatbid': [{
            'seat': '5611802021800040585',
            'bid': [{
              'id': '1515999070',
              'impid': '1',
              'price': 0.45,
              'adm': '<!-- Creative -->',
              'adid': '1515999070',
              'dealid': 'gax-paj2qarjf2g',
              'h': 250,
              'w': 300,
              'adomain': ['testdomain.com']
            }]
          }]
        }
      };
    })

    it('should get the correct bid response', () => {
      const expectedResponse = [{
        'requestId': '23beaa6af6cdde',
        'cpm': 0.45,
        'width': 300,
        'height': 250,
        'creativeId': '1515999070',
        'dealId': 'gax-lvpjgs5b9k4n',
        'currency': 'USD',
        'netRevenue': true,
        'ttl': 300,
        'ad': '<!-- adtag -->',
        'meta': {'advertiserDomains': ['testdomain.com']}
      }];
      const result = spec.interpretResponse(serverResponse);
      expect(Object.keys(result)).to.deep.equal(Object.keys(expectedResponse));
    });

    it('handles empty bid response', () => {
      const response = {
        body: {}
      };
      const result = spec.interpretResponse(response);
      expect(result.length).to.equal(0);
    });
  });
});
