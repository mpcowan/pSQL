import convertCurrency from './currencyConverter.ts';
import isNumber from './isNumber.ts';

const normalizeUnit = (u: string): string => {
  switch (u) {
    // handle capital abbreviations
    case 'K':
      return 'kelvin';
    case 'C':
      return 'celsius';
    case 'F':
      return 'fahrenheit';
    case 'T':
      return 'ton';
    case 'ms':
      return 'millisecond';
    default:
      break;
  }
  const lower = u.trim().toLowerCase().replace(/\s/g, '').replace(/s$/, '');
  switch (lower) {
    // avoid ambiguous abbreviations
    case 'feet':
    case 'ft':
      return 'foot';
    case 'in':
    case 'inche':
      return 'inch';
    case 'yd':
      return 'yard';
    case 'mi':
      return 'mile';
    case 'cm':
      return 'centimeter';
    case 'km':
      return 'kilometer';
    case 'mg':
      return 'milligram';
    case 'g':
      return 'gram';
    case 'kg':
      return 'kilogram';
    case 'lb':
      return 'pound';
    case 'ml':
      return 'milliliter';
    case 'qt':
      return 'quart';
    case 'centurie':
      return 'century';
    case 'celsiu':
      return 'celsius';
    case 'hr':
      return 'hour';
    case 'yr':
      return 'year';
    case 'min':
      return 'minute';
    case 'sec':
      return 'second';
    case 'gal':
      return 'gallon';
    case 'oz':
      return 'ounce';
    case 'sqft':
    case 'squarefeet':
      return 'squarefoot';
    default:
      return lower;
  }
};

const metricPrefixes = {
  yotta: 1e24,
  zetta: 1e21,
  exa: 1e18,
  peta: 1e15,
  tera: 1e12,
  giga: 1e9,
  mega: 1e6,
  kilo: 1e3,
  hecto: 1e2,
  deka: 1e1,
  deci: 1e-1,
  centi: 1e-2,
  milli: 1e-3,
  micro: 1e-6,
  nano: 1e-9,
  pico: 1e-12,
  femto: 1e-15,
  atto: 1e-18,
};

export default async function convert(
  value: number,
  fromUnit: string,
  toUnit: string,
  log
): Promise<number | null> {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (from === to) {
    return value;
  }

  // check for easy metric (SI) conversion
  const fromPrefix = Object.entries(metricPrefixes).find(([prefix]) =>
    from.startsWith(prefix)
  )?.[1];
  const toPrefix = Object.entries(metricPrefixes).find(([prefix]) => to.startsWith(prefix))?.[1];
  if (fromPrefix != null && toPrefix != null) {
    // e.g. centimeter (1e-2) to kilometer (1e3) | 100 * 1e-2 / 1e3 = 0.001
    return (value * fromPrefix) / toPrefix;
  }

  if (to.endsWith(from) && toPrefix != null) {
    // e.g. from meter to kilometer
    return value / toPrefix;
  }
  if (from.endsWith(to) && fromPrefix != null) {
    // e.g. from kilometer to meter
    return value * fromPrefix;
  }

  switch (`${from}:${to}`) {
    // WEIRD LLM LOGIC
    case ':number':
      return value;
    // DISTANCE
    case 'inch:foot':
      return value / 12;
    case 'inch:yard':
      return value / 36;
    case 'inch:mile':
      return value / 63_360;
    case 'inch:mm':
    case 'inch:millimeter':
      return value * 25.4;
    case 'inch:centimeter':
      return value * 2.54;
    case 'inch:meter':
      return value * 0.0254;
    case 'inch:kilometer':
      return value * 0.0000254;

    case 'foot:inch':
      return value * 12;
    case 'foot:yard':
      return value / 3;
    case 'foot:mile':
      return value / 5280;
    case 'foot:mm':
    case 'foot:millimeter':
      return value * 304.8;
    case 'foot:centimeter':
      return value * 30.48;
    case 'foot:meter':
      return value * 0.3048;
    case 'foot:kilometer':
      return value * 0.0003048;

    case 'yard:inch':
      return value * 36;
    case 'yard:foot':
      return value * 3;
    case 'yard:mile':
      return value / 1760;
    case 'yard:mm':
    case 'yard:millimeter':
      return value * 914.4;
    case 'yard:centimeter':
      return value * 91.44;
    case 'yard:meter':
      return value * 0.9144;
    case 'yard:kilometer':
      return value * 0.0009144;

    case 'mile:inch':
      return value * 63_360;
    case 'mile:foot':
      return value * 5_280;
    case 'mile:yard':
      return value * 1760;
    case 'mile:mm':
    case 'mile:millimeter':
      return value * 1_609_344;
    case 'mile:centimeter':
      return value * 160_934.4;
    case 'mile:meter':
      return value * 1_609.344;
    case 'mile:kilometer':
      return value * 1.609344;

    case 'mm:inch':
    case 'millimeter:inch':
      return value * 0.0393700787402;
    case 'mm:foot':
    case 'millimeter:foot':
      return (value * 0.0393700787402) / 12;
    case 'mm:yard':
    case 'millimeter:yard':
      return (value * 0.0393700787402) / 36;
    case 'mm:mile':
    case 'millimeter:mile':
      return (value * 0.0393700787402) / 63_360;

    case 'centimeter:inch':
      return value * 0.393700787402;
    case 'centimeter:foot':
      return (value * 0.393700787402) / 12;
    case 'centimeter:yard':
      return (value * 0.393700787402) / 36;
    case 'centimeter:mile':
      return (value * 0.393700787402) / 63_360;

    case 'meter:inch':
      return value * 39.3700787402;
    case 'meter:foot':
      return (value * 39.3700787402) / 12;
    case 'meter:yard':
      return (value * 39.3700787402) / 36;
    case 'meter:mile':
      return (value * 39.3700787402) / 63_360;

    case 'kilometer:inch':
      return value * 39_370.0787402;
    case 'kilometer:foot':
      return (value * 39_370.0787402) / 12;
    case 'kilometer:yard':
      return (value * 39_370.0787402) / 36;
    case 'kilometer:mile':
      return (value * 39_370.0787402) / 63_360;

    // SPEED
    case 'mph:kph':
    case 'milesperhour:kilometersperhour':
      return value / 0.6214;
    case 'kph:mph':
    case 'kilometersperhour:milesperhour':
      return value * 0.6214;

    // WEIGHT
    case 'pound:gram':
      return value * 453.592;
    case 'pound:ounce':
      return value * 16;
    case 'pound:kilogram':
      return value / 2.2046223;
    case 'pound:ton':
      return value / 2_000;

    case 'ton:pound':
      return value * 2_000;
    case 'ton:gram':
      return value * 907185;
    case 'ton:kilogram':
      return value * 907.18474;

    case 'gram:pound':
      return value / 453.592;
    case 'gram:ton':
      return value / 907185;
    case 'gram:ounce':
      return value / 28.3;

    case 'kilogram:pound':
      return value * 2.2046223;
    case 'kilogram:ton':
      return value * 0.001102;

    case 'ounce:gram':
      return value * 28.3;
    case 'ounce:pound':
      return value / 16;

    // TIME
    case 'millisecond:second':
      return value / 1000;
    case 'millisecond:minute':
      return value / 60_000;
    case 'millisecond:hour':
      return value / 3_600_000;
    case 'millisecond:day':
      return value / 86_400_000;
    case 'millisecond:week':
      return value / 604_800_000;

    case 'second:millisecond':
      return value * 1000;
    case 'second:minute':
      return value / 60;
    case 'second:hour':
      return value / 3_600;
    case 'second:day':
      return value / 86_400;
    case 'second:week':
      return value / 604_800;

    case 'minute:millisecond':
      return value * 60_000;
    case 'minute:second':
      return value * 60;
    case 'minute:hour':
      return value / 60;
    case 'minute:day':
      return value / 1_440;
    case 'minute:week':
      return value / 10_080;

    case 'hour:millisecond':
      return value * 3_600_000;
    case 'hour:second':
      return value * 3_600;
    case 'hour:minute':
      return value * 60;
    case 'hour:day':
      return value / 24;
    case 'hour:week':
      return value / 168;

    case 'day:millisecond':
      return value * 86_400_000;
    case 'day:second':
      return value * 86_400;
    case 'day:minute':
      return value * 1_440;
    case 'day:hour':
      return value * 24;
    case 'day:week':
      return value / 7;
    case 'day:month':
      return value / 30.4167; // APPROX
    case 'day:year':
      return value / 365; // APPROX

    case 'week:millisecond':
      return value * 604_800_000;
    case 'week:second':
      return value * 604_800;
    case 'week:minute':
      return value * 10_080;
    case 'week:hour':
      return value * 168;
    case 'week:day':
      return value * 7;
    case 'week:month':
      return value / 4.34524; // APPROX
    case 'week:year':
      return value / 52.1429; // APPROX

    case 'month:week':
      return value * 4.34524;
    case 'month:year':
      return value / 12;

    case 'year:day':
      return value * 365; // APPROX
    case 'year:week':
      return (value * 365) / 7; // APPROX
    case 'year:month':
      return value * 12;
    case 'year:decade':
      return value / 10;
    case 'year:century':
      return value / 100;
    case 'year:millenia':
      return value / 1_000;

    case 'decade:month':
      return value * 120;
    case 'decade:year':
      return value * 10;
    case 'decade:century':
      return value / 10;
    case 'decade:millenia':
      return value / 100;

    case 'century:month':
      return value * 1_200;
    case 'century:year':
      return value * 100;
    case 'century:decade':
      return value * 10;
    case 'century:millenia':
      return value / 10;

    // TEMPERATURE
    case 'celsius:kelvin':
      return value + 273.15;
    case 'celsius:fahrenheit':
      return value * (9 / 5) + 32;
    case 'kelvin:celsius':
      return value - 273.15;
    case 'kelvin:fahrenheit':
      return (value - 273.15) * (9 / 5) + 32;
    case 'fahrenheit:celsius':
      return (value - 32) * (5 / 9);
    case 'fahrenheit:kelvin':
      return (value - 32) * (5 / 9) + 273.15;

    // MONEY
    case 'cent:dollar':
      return value / 100;
    case 'dollar:cent':
      return value * 100;
    case '$mm:$':
      return value * 1_000_000;

    // INFORMATION SIZE
    case 'bit:byte':
      return value / 8;
    case 'byte:bit':
      return value * 8;

    // quantity
    case 'one:hundred':
      return value / 100;
    case 'one:thousand':
      return value / 1_000;
    case 'one:million':
      return value / 1_000_000;
    case 'one:billion':
      return value / 1_000_000_000;
    case 'one:trillion':
      return value / 1_000_000_000_000;

    case 'hundred:one':
      return value * 100;
    case 'hundred:thousand':
      return value / 10;
    case 'hundred:million':
      return value / 10_000;
    case 'hundred:billion':
      return value / 10_000_000;
    case 'hundred:trillion':
      return value / 10_000_000_000;

    case 'thousand:one':
      return value * 1_000;
    case 'thousand:hundred':
      return value * 10;
    case 'thousand:million':
      return value / 1_000;
    case 'thousand:billion':
      return value / 1_000_000;
    case 'thousand:trillion':
      return value / 1_000_000_000;

    case 'million:one':
      return value * 1_000_000;
    case 'million:hundred':
      return value * 10_000;
    case 'million:thousand':
      return value * 1_000;
    case 'million:billion':
      return value / 1_000;
    case 'million:trillion':
      return value / 1_000_000;

    case 'billion:one':
      return value * 1_000_000_000;
    case 'billion:hundred':
      return value * 10_000_000;
    case 'billion:thousand':
      return value * 1_000_000;
    case 'billion:million':
      return value * 1_000;
    case 'billion:trillion':
      return value / 1_000;

    case 'trillion:one':
      return value * 1_000_000_000_000;
    case 'trillion:hundred':
      return value * 10_000_000_000;
    case 'trillion:thousand':
      return value * 1_000_000_000;
    case 'trillion:million':
      return value * 1_000_000;
    case 'trillion:billion':
      return value * 1_000;

    // AREA

    case 'squarefoot:acre':
    case 'squarefoot:ac':
      return value / 43_560;
    case 'squarefoot:hectare':
    case 'squarefoot:ha':
      return value / 107_639;

    case 'acre:squarefoot':
    case 'ac:squarefoot':
      return value * 43_560;
    case 'ac:ha':
    case 'acre:hectare':
      return value * 0.405;

    case 'hectare:squarefoot':
    case 'ha:squarefoot':
      return value * 107_639;
    case 'ha:ac':
    case 'hectare:acre':
      return value * 2.47105;

    // VOLUME
    case 'cup:pint':
      return value / 2;
    case 'cup:quart':
      return value / 4;
    case 'cup:gallon':
      return value / 16;
    case 'cup:milliliter':
      return value * 236.588;
    case 'cup:liter':
      return value * 0.236588;

    case 'pint:cup':
      return value * 2;
    case 'pint:quart':
      return value / 2;
    case 'pint:gallon':
      return value / 8;
    case 'pint:milliliter':
      return value * 473.176;
    case 'pint:liter':
      return value * 0.473176;

    case 'quart:cup':
      return value * 4;
    case 'quart:pint':
      return value * 2;
    case 'quart:gallon':
      return value / 4;
    case 'quart:milliliter':
      return value * 946.353;
    case 'quart:liter':
      return value * 0.946353;

    case 'gallon:cup':
      return value * 16;
    case 'gallon:pint':
      return value * 8;
    case 'gallon:quart':
      return value * 4;
    case 'gallon:milliliter':
      return value * 3_785.41;
    case 'gallon:liter':
      return value * 3.78541;

    case 'liter:cup':
      return (value / 3.78541) * 16;
    case 'liter:pint':
      return (value / 3.78541) * 8;
    case 'liter:quart':
      return (value / 3.78541) * 4;
    case 'liter:gallon':
      return value / 3.78541;

    default: {
      // maybe currency?
      const x = await convertCurrency(value, fromUnit, toUnit, log);
      if (isNumber(x)) {
        return x;
      }
      log.error({ fromUnit, toUnit }, 'Unknown unit conversion');
      return null;
    }
  }
}
