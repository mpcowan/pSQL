import round from './round.ts';

const apiKey = process.env.ER_API_KEY;

const rateCache = {
  rates: null,
  expires: null,
};

const normalizeCurrency = (currency: string, log): string | null => {
  switch (currency.trim().toLowerCase()) {
    case 'aed':
    case 'uae dirham':
      return 'AED';
    case 'afn':
    case 'afghan afghani':
      return 'AFN';
    case 'all':
    case 'albanian lek':
      return 'ALL';
    case 'amd':
    case 'armenian dram':
      return 'AMD';
    case 'ang':
    case 'netherlands antillian guilder':
      return 'ANG';
    case 'aoa':
    case 'angolan kwanza':
      return 'AOA';
    case 'ars':
    case 'argentine peso':
      return 'ARS';
    case 'aud':
    case 'australian dollar':
      return 'AUD';
    case 'awg':
    case 'aruban florin':
      return 'AWG';
    case 'azn':
    case 'azerbaijani manat':
      return 'AZN';
    case 'bam':
    case 'bosnia and herzegovina mark':
      return 'BAM';
    case 'bbd':
    case 'barbados dollar':
      return 'BBD';
    case 'bdt':
    case 'bangladeshi taka':
      return 'BDT';
    case 'bgn':
    case 'bulgarian lev':
      return 'BGN';
    case 'bhd':
    case 'bahraini dinar':
      return 'BHD';
    case 'bif':
    case 'burundian franc':
      return 'BIF';
    case 'bmd':
    case 'bermudian dollar':
      return 'BMD';
    case 'bnd':
    case 'brunei dollar':
      return 'BND';
    case 'bob':
    case 'bolivian boliviano':
      return 'BOB';
    case 'brl':
    case 'brazilian real':
      return 'BRL';
    case 'bsd':
    case 'bahamian dollar':
      return 'BSD';
    case 'btn':
    case 'bhutanese ngultrum':
      return 'BTN';
    case 'bwp':
    case 'botswana pula':
      return 'BWP';
    case 'byn':
    case 'belarusian ruble':
      return 'BYN';
    case 'bzd':
    case 'belize dollar':
      return 'BZD';
    case 'cad':
    case 'canadian dollar':
      return 'CAD';
    case 'cdf':
    case 'congolese franc':
      return 'CDF';
    case 'chf':
    case 'swiss franc':
      return 'CHF';
    case 'clp':
    case 'chilean peso':
      return 'CLP';
    case 'cny':
    case 'chinese renminbi':
      return 'CNY';
    case 'cop':
    case 'colombian peso':
      return 'COP';
    case 'crc':
    case 'costa rican colon':
      return 'CRC';
    case 'cup':
    case 'cuban peso':
      return 'CUP';
    case 'cve':
    case 'cape verdean escudo':
      return 'CVE';
    case 'czk':
    case 'czech koruna':
      return 'CZK';
    case 'djf':
    case 'djiboutian franc':
      return 'DJF';
    case 'dkk':
    case 'danish krone':
      return 'DKK';
    case 'dop':
    case 'dominican peso':
      return 'DOP';
    case 'dzd':
    case 'algerian dinar':
      return 'DZD';
    case 'egp':
    case 'egyptian pound':
      return 'EGP';
    case 'ern':
    case 'eritrean nakfa':
      return 'ERN';
    case 'etb':
    case 'ethiopian birr':
      return 'ETB';
    case 'eur':
    case 'euro':
    case '€':
      return 'EUR';
    case 'fjd':
    case 'fiji dollar':
      return 'FJD';
    case 'fkp':
    case 'falkland islands pound':
      return 'FKP';
    case 'fok':
    case 'faroese króna':
      return 'FOK';
    case 'gbp':
    case 'pound sterling':
    case '£':
      return 'GBP';
    case 'gel':
    case 'georgian lari':
      return 'GEL';
    case 'ggp':
    case 'guernsey pound':
      return 'GGP';
    case 'ghs':
    case 'ghanaian cedi':
      return 'GHS';
    case 'gip':
    case 'gibraltar pound':
      return 'GIP';
    case 'gmd':
    case 'gambian dalasi':
      return 'GMD';
    case 'gnf':
    case 'guinean franc':
      return 'GNF';
    case 'gtq':
    case 'guatemalan quetzal':
      return 'GTQ';
    case 'gyd':
    case 'guyanese dollar':
      return 'GYD';
    case 'hkd':
    case 'hong kong dollar':
      return 'HKD';
    case 'hnl':
    case 'honduran lempira':
      return 'HNL';
    case 'hrk':
    case 'croatian kuna':
      return 'HRK';
    case 'htg':
    case 'haitian gourde':
      return 'HTG';
    case 'huf':
    case 'hungarian forint':
      return 'HUF';
    case 'idr':
    case 'indonesian rupiah':
      return 'IDR';
    case 'ils':
    case 'israeli new shekel':
      return 'ILS';
    case 'imp':
    case 'manx pound':
      return 'IMP';
    case 'inr':
    case 'indian rupee':
      return 'INR';
    case 'iqd':
    case 'iraqi dinar':
      return 'IQD';
    case 'irr':
    case 'iranian rial':
      return 'IRR';
    case 'isk':
    case 'icelandic króna':
      return 'ISK';
    case 'jep':
    case 'jersey pound':
      return 'JEP';
    case 'jmd':
    case 'jamaican dollar':
      return 'JMD';
    case 'jod':
    case 'jordanian dinar':
      return 'JOD';
    case 'jpy':
    case 'japanese yen':
    case '¥':
      return 'JPY';
    case 'kes':
    case 'kenyan shilling':
      return 'KES';
    case 'kgs':
    case 'kyrgyzstani som':
      return 'KGS';
    case 'khr':
    case 'cambodian riel':
      return 'KHR';
    case 'kid':
    case 'kiribati dollar':
      return 'KID';
    case 'kmf':
    case 'comorian franc':
      return 'KMF';
    case 'krw':
    case 'south korean won':
      return 'KRW';
    case 'kwd':
    case 'kuwaiti dinar':
      return 'KWD';
    case 'kyd':
    case 'cayman islands dollar':
      return 'KYD';
    case 'kzt':
    case 'kazakhstani tenge':
      return 'KZT';
    case 'lak':
    case 'lao kip':
      return 'LAK';
    case 'lbp':
    case 'lebanese pound':
      return 'LBP';
    case 'lkr':
    case 'sri lanka rupee':
      return 'LKR';
    case 'lrd':
    case 'liberian dollar':
      return 'LRD';
    case 'lsl':
    case 'lesotho loti':
      return 'LSL';
    case 'lyd':
    case 'libyan dinar':
      return 'LYD';
    case 'mad':
    case 'moroccan dirham':
      return 'MAD';
    case 'mdl':
    case 'moldovan leu':
      return 'MDL';
    case 'mga':
    case 'malagasy ariary':
      return 'MGA';
    case 'mkd':
    case 'macedonian denar':
      return 'MKD';
    case 'mmk':
    case 'burmese kyat':
      return 'MMK';
    case 'mnt':
    case 'mongolian tögrög':
      return 'MNT';
    case 'mop':
    case 'macanese pataca':
      return 'MOP';
    case 'mru':
    case 'mauritanian ouguiya':
      return 'MRU';
    case 'mur':
    case 'mauritian rupee':
      return 'MUR';
    case 'mvr':
    case 'maldivian rufiyaa':
      return 'MVR';
    case 'mwk':
    case 'malawian kwacha':
      return 'MWK';
    case 'mxn':
    case 'mexican peso':
      return 'MXN';
    case 'myr':
    case 'malaysian ringgit':
      return 'MYR';
    case 'mzn':
    case 'mozambican metical':
      return 'MZN';
    case 'nad':
    case 'namibian dollar':
      return 'NAD';
    case 'ngn':
    case 'nigerian naira':
      return 'NGN';
    case 'nio':
    case 'nicaraguan córdoba':
      return 'NIO';
    case 'nok':
    case 'norwegian krone':
      return 'NOK';
    case 'npr':
    case 'nepalese rupee':
      return 'NPR';
    case 'nzd':
    case 'new zealand dollar':
      return 'NZD';
    case 'omr':
    case 'omani rial':
      return 'OMR';
    case 'pab':
    case 'panamanian balboa':
      return 'PAB';
    case 'pen':
    case 'peruvian sol':
      return 'PEN';
    case 'pgk':
    case 'papua new guinean kina':
      return 'PGK';
    case 'php':
    case 'philippine peso':
      return 'PHP';
    case 'pkr':
    case 'pakistani rupee':
      return 'PKR';
    case 'pln':
    case 'polish złoty':
      return 'PLN';
    case 'pyg':
    case 'paraguayan guaraní':
      return 'PYG';
    case 'qar':
    case 'qatari riyal':
      return 'QAR';
    case 'ron':
    case 'romanian leu':
      return 'RON';
    case 'rsd':
    case 'serbian dinar':
      return 'RSD';
    case 'rub':
    case 'russian ruble':
      return 'RUB';
    case 'rwf':
    case 'rwandan franc':
      return 'RWF';
    case 'sar':
    case 'saudi riyal':
      return 'SAR';
    case 'sbd':
    case 'solomon islands dollar':
      return 'SBD';
    case 'scr':
    case 'seychellois rupee':
      return 'SCR';
    case 'sdg':
    case 'sudanese pound':
      return 'SDG';
    case 'sek':
    case 'swedish krona':
      return 'SEK';
    case 'sgd':
    case 'singapore dollar':
      return 'SGD';
    case 'shp':
    case 'saint helena pound':
      return 'SHP';
    case 'sle':
    case 'sierra leonean leone':
      return 'SLE';
    case 'sos':
    case 'somali shilling':
      return 'SOS';
    case 'srd':
    case 'surinamese dollar':
      return 'SRD';
    case 'ssp':
    case 'south sudanese pound':
      return 'SSP';
    case 'stn':
    case 'são tomé and príncipe dobra':
      return 'STN';
    case 'syp':
    case 'syrian pound':
      return 'SYP';
    case 'szl':
    case 'eswatini lilangeni':
      return 'SZL';
    case 'thb':
    case 'thai baht':
      return 'THB';
    case 'tjs':
    case 'tajikistani somoni':
      return 'TJS';
    case 'tmt':
    case 'turkmenistan manat':
      return 'TMT';
    case 'tnd':
    case 'tunisian dinar':
      return 'TND';
    case 'top':
    case 'tongan paʻanga':
      return 'TOP';
    case 'try':
    case 'turkish lira':
      return 'TRY';
    case 'ttd':
    case 'trinidad and tobago dollar':
      return 'TTD';
    case 'tvd':
    case 'tuvaluan dollar':
      return 'TVD';
    case 'twd':
    case 'new taiwan dollar':
      return 'TWD';
    case 'tzs':
    case 'tanzanian shilling':
      return 'TZS';
    case 'uah':
    case 'ukrainian hryvnia':
      return 'UAH';
    case 'ugx':
    case 'ugandan shilling':
      return 'UGX';
    case 'usd':
    case 'united states dollar':
      return 'USD';
    case 'uyu':
    case 'uruguayan peso':
      return 'UYU';
    case 'uzs':
    case "uzbekistani so'm":
      return 'UZS';
    case 'ves':
    case 'venezuelan bolívar soberano':
      return 'VES';
    case 'vnd':
    case 'vietnamese đồng':
      return 'VND';
    case 'vuv':
    case 'vanuatu vatu':
      return 'VUV';
    case 'wst':
    case 'samoan tālā':
      return 'WST';
    case 'xaf':
    case 'central african cfa franc':
      return 'XAF';
    case 'xcd':
    case 'east caribbean dollar':
      return 'XCD';
    case 'xdr':
    case 'special drawing rights':
      return 'XDR';
    case 'xof':
    case 'west african cfa franc':
      return 'XOF';
    case 'xpf':
    case 'cfp franc':
      return 'XPF';
    case 'yer':
    case 'yemeni rial':
      return 'YER';
    case 'zar':
    case 'south african rand':
      return 'ZAR';
    case 'zmw':
    case 'zambian kwacha':
      return 'ZMW';
    case 'zwl':
    case 'zimbabwean dollar':
      return 'ZWL';
    default:
      log.error({ currency }, 'Unknown currency');
      return null;
  }
};

interface apiResp {
  result: string;
  base_code: string;
  conversion_rates?: { [key: string]: number };
}

let ratesFetchPromise;
const fetchForexRates = async (log): Promise<{ [key: string]: number }> => {
  if (rateCache.rates != null && rateCache.expires > Date.now()) {
    return rateCache.rates;
  }

  if (!ratesFetchPromise) {
    // gate to a single concurrent request
    log.info('Fetching currency exchange rates');
    ratesFetchPromise = fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`).then(
      (resp) => resp.json()
    );
  }
  const data = (await ratesFetchPromise) as apiResp;
  ratesFetchPromise = null;
  if (data?.result === 'success') {
    const rates = data.conversion_rates;
    rateCache.rates = rates;
    rateCache.expires = Date.now() + 3_600_000; // 1 hr
    return rates;
  } else {
    throw new Error('Error fetching forex');
  }
};

export default async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  log
): Promise<number | null> {
  const from = normalizeCurrency(fromCurrency, log);
  const to = normalizeCurrency(toCurrency, log);

  if (from == null || to == null) {
    return null;
  }

  let rates;
  try {
    rates = await fetchForexRates(log);
  } catch (err) {
    log.error({ err }, 'Error fetching forex rates');
    return null;
  }

  // rates are USD based
  // fromCurrency -> USD -> toCurrency

  const inUSD = amount / rates[from];
  return round(inUSD * rates[to], 4);
}
