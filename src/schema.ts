export const schema = {
  name: 'processDataset',
  description:
    'Performs the specified operations in the order specified on the dataset and displays the resulting output to the user. Numbers are automatically parsed even when formatted like monetary values. Provide date formats as appropriate with luxon standalone tokens. When performing an operation on a field that contains arrays of objects use dot notation. If the dataset is useless for the question just use the drop operation.',
  parameters: {
    type: 'object',
    properties: {
      operations: {
        type: 'array',
        items: {
          type: 'object',
          oneOf: [
            {
              type: 'object',
              description: 'Ignores the entire dataset and returns an empty dataset',
              properties: {
                op: { enum: ['drop'] },
              },
            },
            {
              type: 'object',
              description:
                "Converts a single row of data into multiple rows based on the array items in the specified column similar to MongoDB's $unwind",
              properties: {
                op: { enum: ['unwindArray'] },
                column: { type: 'string' },
              },
            },
            {
              type: 'object',
              properties: {
                op: { enum: ['formatDates'] },
                column: { type: 'string' },
                currentFormat: { type: 'string' },
                desiredFormat: { type: 'string' },
                as: { type: 'string' },
              },
            },
            {
              type: 'object',
              properties: {
                op: { enum: ['dateDiff'] },
                interval: {
                  enum: ['years', 'quarters', 'months', 'weeks', 'days', 'hours', 'minutes'],
                },
                startColumnOrDate: { type: 'string' },
                startDateFormat: { type: 'string' },
                endColumnOrDate: { type: 'string' },
                endDateFormat: { type: 'string' },
                as: { type: 'string' },
              },
            },
            {
              type: 'object',
              properties: {
                op: { enum: ['convertUnits'] },
                column: { type: 'string' },
                from: {
                  description: 'Unit or currency to convert from e.g. mph, USD, liters…',
                  type: 'string',
                },
                to: {
                  description: 'Unit or currency to convert to e.g. kph, EUR, gallons…',
                  type: 'string',
                },
                as: { type: 'string' },
              },
            },
            {
              type: 'object',
              properties: {
                op: { enum: ['combineColumns'] },
                columns: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 2,
                },
                function: {
                  enum: [
                    'ADD',
                    'SUB',
                    'SUB_ABS',
                    'MUL',
                    'DIV',
                    'MOD',
                    'AVG',
                    'MAX',
                    'MIN',
                    'CONCAT',
                  ],
                },
                as: { type: 'string' },
              },
            },
            {
              type: 'object',
              description:
                'Creates a new column by running the function on each cell of the column. AVG, SUM, MIN, MAX, MEDIAN, STDEV, and VARIANCE are only supported for columns containing numeric arrays.',
              properties: {
                op: { enum: ['mapColumn'] },
                column: { type: 'string' },
                function: {
                  enum: [
                    'LEN',
                    'ABS',
                    'ROUND',
                    'CEIL',
                    'FLOOR',
                    'UCASE',
                    'LCASE',
                    'ADD',
                    'SUB',
                    'MUL',
                    'DIV',
                    'MOD',
                    'SQRT',
                    'POW',
                    'COALESCE',
                    'AVG',
                    'SUM',
                    'MIN',
                    'MAX',
                    'MEDIAN',
                    'STDEV',
                    'VARIANCE',
                  ],
                },
                functionArg: {
                  description:
                    'Only provide literal values; column names are not supported, for that use combineColumns instead.',
                  type: ['number', 'string'],
                },
                as: { type: 'string' },
              },
            },
            {
              type: 'object',
              properties: {
                op: { enum: ['filter'] },
                condition: {
                  type: 'object',
                  oneOf: [
                    {
                      properties: {
                        and: {
                          type: 'array',
                          items: {
                            type: 'object',
                            oneOf: [
                              { $ref: '#/$defs/condition' },
                              {
                                properties: {
                                  or: {
                                    type: 'array',
                                    items: { $ref: '#/$defs/condition' },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                    {
                      properties: {
                        or: {
                          type: 'array',
                          items: {
                            type: 'object',
                            oneOf: [
                              { $ref: '#/$defs/condition' },
                              {
                                properties: {
                                  and: {
                                    type: 'array',
                                    items: { $ref: '#/$defs/condition' },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                    { $ref: '#/$defs/condition' },
                  ],
                },
              },
            },
            {
              type: 'object',
              properties: {
                op: { enum: ['groupBy'] },
                columns: { type: 'array', items: { type: 'string' } },
                aggregations: { $ref: '#/$defs/aggregations' },
              },
            },
            {
              type: 'object',
              properties: {
                op: { enum: ['orderBy'] },
                column: { type: 'string' },
                direction: { enum: ['ASC', 'DESC'] },
                sortType: { enum: ['alphabetic', 'numeric', 'date'] },
                dateFormat: { type: 'string' },
              },
              required: ['op', 'column', 'direction', 'sortType'],
            },
            {
              type: 'object',
              properties: {
                op: { enum: ['offset'] },
                amount: { type: 'number' },
              },
            },
            {
              type: 'object',
              properties: {
                op: { enum: ['limit'] },
                amount: { type: 'number' },
              },
            },
            {
              type: 'object',
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    op: { enum: ['select'] },
                    columns: { type: 'array', items: { type: 'string' } },
                    distinct: { type: 'boolean' },
                  },
                },
                {
                  type: 'object',
                  properties: {
                    op: { enum: ['select'] },
                    aggregations: { $ref: '#/$defs/aggregations' },
                  },
                },
              ],
            },
          ],
        },
      },
    },
    required: ['operations'],
    $defs: {
      aggregations: {
        type: 'array',
        items: {
          type: 'object',
          description:
            'Aggregate rows by running the function on each cell of the column. To count all rows specify column as *.',
          properties: {
            column: { type: 'string' },
            function: {
              enum: [
                'COUNT',
                'COUNT_DISTINCT',
                'AVG',
                'MIN',
                'MAX',
                'SUM',
                'MEDIAN',
                'STDEV',
                'VARIANCE',
                'FIRST',
                'LAST',
              ],
            },
            as: { type: 'string' },
          },
        },
      },
      condition: {
        type: 'object',
        properties: {
          column: { type: 'string' },
          columnDateFormat: { type: 'string' },
          operator: {
            enum: [
              '==',
              '!=',
              '>',
              '<',
              '>=',
              '<=',
              'startsWith',
              'endsWith',
              'contains',
              'isNull',
              'isNotNull',
            ],
          },
          not: { type: 'boolean' },
          compareTo: { type: ['string', 'number'] },
          compareToDateFormat: { type: 'string' },
          dataType: { enum: ['string', 'number', 'date'] },
        },
        required: ['column', 'operator'],
      },
    },
  },
};
