import {isEmptyStr, isFn, isStr, logError, mergeDeep} from '../src/utils.js';
import {loadExternalScript} from '../src/adloader.js';
import {submodule} from '../src/hook.js';
import {getGlobal} from '../src/prebidGlobal.js';

import { MODULE_TYPE_RTD } from '../src/activities/modules.js';

const MODULE_NAME = 'medianet';
const SOURCE = MODULE_NAME + 'rtd';
const AD_UNIT_CODE_TARGETING_KEY = 'mnadc';
const OPEN_RTB_FIELD = 'ortb2Imp';

const getClientUrl = (customerId, domain) => `https://warp.media.net/js/tags/prebidrtdclient.js?cid=${customerId}&dn=${domain}`;

window.mnjs = window.mnjs || {};
window.mnjs.que = window.mnjs.que || [];

function init(config) {
  const customerId = config.params && config.params.cid;
  if (!customerId || !isStr(customerId) || isEmptyStr(customerId)) {
    logError(`${SOURCE}: cid should be a string`);
    return false;
  }

  loadRtdScript(customerId);
  executeCommand(() => window.mnjs.setData({
    module: 'iref',
    name: 'initIRefresh',
    data: {config, prebidGlobal: getGlobal()},
  }, SOURCE));
  return true;
}

function getBidRequestData(requestBidsProps, callback, config, userConsent) {
  executeCommand(() => {
    const adUnits = getAdUnits(requestBidsProps.adUnits, requestBidsProps.adUnitCodes);
    const request = window.mnjs.onPrebidRequestBid({requestBidsProps, config, userConsent});
    if (!request) {
      callback();
      return;
    }
    const success = (adUnitProps, openRtbProps) => {
      adUnits.forEach(adUnit => {
        adUnit[OPEN_RTB_FIELD] = adUnit[OPEN_RTB_FIELD] || {};
        mergeDeep(adUnit[OPEN_RTB_FIELD], openRtbProps[adUnit.code]);
        mergeDeep(adUnit, adUnitProps[adUnit.code]);
      });
      callback();
    };
    const error = () => callback();
    request.onComplete(error, success);
  });
}

function onAuctionInitEvent(auctionInit) {
  executeCommand(() => window.mnjs.setData({
    module: 'iref',
    name: 'auctionInit',
    data: {auction: auctionInit},
  }, SOURCE));
}

function getTargetingData(adUnitCodes, config, consent, auction) {
  const adUnits = getAdUnits(auction.adUnits, adUnitCodes);
  let targetingData = {};
  if (window.mnjs.loaded && isFn(window.mnjs.getTargetingData)) {
    targetingData = window.mnjs.getTargetingData(adUnitCodes, adUnits, SOURCE) || {};
  }
  const targeting = {};
  adUnitCodes.forEach(adUnitCode => {
    targeting[adUnitCode] = targeting[adUnitCode] || {};
    targetingData[adUnitCode] = targetingData[adUnitCode] || {};
    targeting[adUnitCode] = {
      // we use this to find gpt slot => prebid ad unit
      [AD_UNIT_CODE_TARGETING_KEY]: adUnitCode,
      ...targetingData[adUnitCode]
    };
  });
  return targeting;
}

function executeCommand(command) {
  window.mnjs.que.push(command);
}

function loadRtdScript(customerId) {
  const url = getClientUrl(customerId, window.location.hostname);
  loadExternalScript(url, MODULE_TYPE_RTD, MODULE_NAME)
}

function getAdUnits(adUnits, adUnitCodes) {
  adUnits = adUnits || getGlobal().adUnits || [];
  if (adUnitCodes && adUnitCodes.length) {
    adUnits = adUnits.filter(unit => adUnitCodes.includes(unit.code));
  }
  return adUnits;
}

export const medianetRtdModule = {
  name: MODULE_NAME,
  init,
  getBidRequestData,
  onAuctionInitEvent,
  getTargetingData,
};

function registerSubModule() {
  submodule('realTimeData', medianetRtdModule);
}

registerSubModule();
