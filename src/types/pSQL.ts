export interface FormatDatesOp {
  op: 'formatDates';
  column: string;
  currentFormat: string;
  desiredFormat: string;
  as: string;
}

export interface DateDiffOp {
  op: 'dateDiff';
  interval: 'years' | 'quarters' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds';
  startColumnOrDate: string;
  startDateFormat: string;
  endColumnOrDate: string;
  endDateFormat: string;
  as: string;
}

export interface ConvertUnitsOp {
  op: 'convertUnits';
  column: string;
  from: string;
  to: string;
  as: string;
}

export interface CombineColumnsOp {
  op: 'combineColumns';
  columns: string[];
  function:
    | 'ADD'
    | 'SUB'
    | 'SUB_ABS'
    | 'MUL'
    | 'DIV'
    | 'MOD'
    | 'AVG'
    | 'MAX'
    | 'MIN'
    | 'MEDIAN'
    | 'MODE'
    | 'STDEV'
    | 'CONCAT';
  as: string;
}

export interface MapColumnOp {
  op: 'mapColumn';
  column: string;
  function:
    | 'LEN'
    | 'ABS'
    | 'ROUND'
    | 'CEIL'
    | 'FLOOR'
    | 'UCASE'
    | 'LCASE'
    | 'ADD'
    | 'SUB'
    | 'MUL'
    | 'DIV'
    | 'SQRT'
    | 'POW'
    | 'MOD'
    | 'COALESCE'
    | 'AVG'
    | 'SUM'
    | 'MIN'
    | 'MAX'
    | 'MEDIAN'
    | 'STDEV'
    | 'VARIANCE';
  functionArg?: number | string;
  as?: string;
}

export interface Comparison {
  column: string;
  dataType?: 'string' | 'number' | 'date';
  columnDateFormat?: string;
  operator:
    | '=='
    | '!='
    | '>'
    | '<'
    | '>='
    | '<='
    | 'startsWith'
    | 'endsWith'
    | 'contains'
    | 'isNull'
    | 'isNotNull';
  not?: boolean;
  compareTo?: string | number | boolean;
  compareToDateFormat?: string;
}

interface AndComparison {
  and: (Comparison | AndComparison | OrComparison)[];
}

interface OrComparison {
  or: (Comparison | AndComparison | OrComparison)[];
}

export type FilterCondition = Comparison | AndComparison | OrComparison;

export interface FilterOp {
  op: 'filter';
  condition: FilterCondition;
}

export interface Aggregation {
  column: string;
  function:
    | 'COUNT'
    | 'COUNT_DISTINCT'
    | 'AVG'
    | 'MIN'
    | 'MAX'
    | 'SUM'
    | 'MEDIAN'
    | 'STDEV'
    | 'VARIANCE'
    | 'RANGE'
    | 'FIRST'
    | 'LAST';
  as: string;
}

export interface GroupByOp {
  op: 'groupBy';
  columns: string[];
  aggregations: Aggregation[] | Aggregation;
}

export interface OrderByOp {
  op: 'orderBy';
  column: string;
  direction: 'ASC' | 'DESC';
  sortType: 'alphabetic' | 'numeric' | 'date';
  dateFormat?: string;
}

export interface OffsetOp {
  op: 'offset';
  amount: number;
}

export interface LimitOp {
  op: 'limit';
  amount: number;
}

export interface ColumnSelectOp {
  op: 'select';
  columns: string[];
  distinct?: boolean;
}

export interface AggregationSelectOp {
  op: 'select';
  aggregations: Aggregation[] | Aggregation;
}

export type SelectOp = ColumnSelectOp | AggregationSelectOp;

export interface UnwindArrayOp {
  op: 'unwindArray';
  column: string;
}

export interface DropOp {
  op: 'drop';
}

export type Operation =
  | FormatDatesOp
  | DateDiffOp
  | ConvertUnitsOp
  | CombineColumnsOp
  | MapColumnOp
  | FilterOp
  | GroupByOp
  | OrderByOp
  | OffsetOp
  | LimitOp
  | SelectOp
  | UnwindArrayOp
  | DropOp;

export interface pSQL {
  operations: Operation[];
}
