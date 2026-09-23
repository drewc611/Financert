/* Embedded snapshot of the Federal Reserve Distributional Financial
   Accounts, generated from backend/data/dfa_snapshot.json. Lets the
   dashboard render when the API is unreachable. Regenerate with:
     python backend/tools/build_fallback.py
   Do not hand-edit. */

export const fallbackData = {
  "source": {
    "name": "Federal Reserve Distributional Financial Accounts",
    "publisher": "Board of Governors of the Federal Reserve System",
    "retrieved_via": "bulk download, dfa-networth-levels-detail.csv",
    "url": "https://www.federalreserve.gov/releases/z1/dataviz/dfa/",
    "download_url": "https://www.federalreserve.gov/releases/z1/dataviz/download/zips/dfa.zip",
    "retrieved_at": "2026-09-23T06:32:11+00:00",
    "archive_sha256": "e7f35451dc4df13986ef416d8659d00689ad98a9af79f4b09977e41be5e35919",
    "archive_bytes": 895897,
    "units": "US dollars, not seasonally adjusted"
  },
  "latest_period": "2026-04-01",
  "latest_complete_period": "2026-04-01",
  "complete_periods": [
    "2016-07-01",
    "2016-10-01",
    "2017-01-01",
    "2017-04-01",
    "2017-07-01",
    "2017-10-01",
    "2018-01-01",
    "2018-04-01",
    "2018-07-01",
    "2018-10-01",
    "2019-01-01",
    "2019-04-01",
    "2019-07-01",
    "2019-10-01",
    "2020-01-01",
    "2020-04-01",
    "2020-07-01",
    "2020-10-01",
    "2021-01-01",
    "2021-04-01",
    "2021-07-01",
    "2021-10-01",
    "2022-01-01",
    "2022-04-01",
    "2022-07-01",
    "2022-10-01",
    "2023-01-01",
    "2023-04-01",
    "2023-07-01",
    "2023-10-01",
    "2024-01-01",
    "2024-04-01",
    "2024-07-01",
    "2024-10-01",
    "2025-01-01",
    "2025-04-01",
    "2025-07-01",
    "2025-10-01",
    "2026-01-01",
    "2026-04-01"
  ],
  "group_order": [
    "top1",
    "next9",
    "next40",
    "bottom50"
  ],
  "periods": [
    "2016-07-01",
    "2016-10-01",
    "2017-01-01",
    "2017-04-01",
    "2017-07-01",
    "2017-10-01",
    "2018-01-01",
    "2018-04-01",
    "2018-07-01",
    "2018-10-01",
    "2019-01-01",
    "2019-04-01",
    "2019-07-01",
    "2019-10-01",
    "2020-01-01",
    "2020-04-01",
    "2020-07-01",
    "2020-10-01",
    "2021-01-01",
    "2021-04-01",
    "2021-07-01",
    "2021-10-01",
    "2022-01-01",
    "2022-04-01",
    "2022-07-01",
    "2022-10-01",
    "2023-01-01",
    "2023-04-01",
    "2023-07-01",
    "2023-10-01",
    "2024-01-01",
    "2024-04-01",
    "2024-07-01",
    "2024-10-01",
    "2025-01-01",
    "2025-04-01",
    "2025-07-01",
    "2025-10-01",
    "2026-01-01",
    "2026-04-01"
  ],
  "asset_classes": [
    {
      "key": "corporate_equities",
      "label": "Stocks & Mutual Funds",
      "liquid": true,
      "blurb": "Directly held corporate equities plus mutual fund shares, excluding those held through a DC pension.",
      "columns": [
        "Corporate equities and mutual fund shares"
      ]
    },
    {
      "key": "private_business",
      "label": "Private Business Equity",
      "liquid": false,
      "blurb": "Proprietors' equity in noncorporate business -- partnerships, S-corps, sole proprietorships, and property held to rent out.",
      "columns": [
        "Miscellaneous other equity"
      ]
    },
    {
      "key": "pension",
      "label": "Pensions & Retirement",
      "liquid": false,
      "blurb": "Defined benefit and defined contribution pension entitlements.",
      "columns": [
        "DB pension entitlements",
        "DC pension entitlements"
      ]
    },
    {
      "key": "real_estate",
      "label": "Real Estate",
      "liquid": false,
      "blurb": "Owner-occupied real estate including vacant land and mobile homes, at market value.",
      "columns": [
        "Real estate"
      ]
    },
    {
      "key": "deposits",
      "label": "Cash & Deposits",
      "liquid": true,
      "blurb": "Checkable deposits and currency, time deposits and short-term investments.",
      "columns": [
        "Deposits"
      ]
    },
    {
      "key": "money_market",
      "label": "Money Market Funds",
      "liquid": true,
      "blurb": "Money market mutual fund shares.",
      "columns": [
        "Money market fund shares"
      ]
    },
    {
      "key": "debt_securities",
      "label": "Bonds",
      "liquid": true,
      "blurb": "Treasury, municipal, corporate and foreign bonds held directly.",
      "columns": [
        "Debt securities"
      ]
    },
    {
      "key": "consumer_durables",
      "label": "Consumer Durables",
      "liquid": false,
      "blurb": "Vehicles, appliances, furnishings -- counted as assets by the Fed, not as investments.",
      "columns": [
        "Consumer durables"
      ]
    },
    {
      "key": "annuities",
      "label": "Annuities",
      "liquid": false,
      "blurb": "Annuities sold by life insurers directly to households, outside a pension.",
      "columns": [
        "Annuities"
      ]
    },
    {
      "key": "life_insurance",
      "label": "Life Insurance",
      "liquid": false,
      "blurb": "Cash value of life insurance reserves.",
      "columns": [
        "Life insurance reserves"
      ]
    },
    {
      "key": "loans_assets",
      "label": "Loans Receivable",
      "liquid": false,
      "blurb": "Mortgages and other loans held as assets.",
      "columns": [
        "Loans (Assets)"
      ]
    },
    {
      "key": "misc_assets",
      "label": "Other Assets",
      "liquid": false,
      "blurb": "Miscellaneous assets not classified elsewhere.",
      "columns": [
        "Miscellaneous assets"
      ]
    },
    {
      "key": "unallocated",
      "label": "Unallocated",
      "liquid": false,
      "blurb": "Residual between the Fed's published asset total and the categories above. Rounding only, since the taxonomy now covers every component.",
      "columns": []
    }
  ],
  "liability_classes": [
    {
      "key": "home_mortgages",
      "label": "Home Mortgages",
      "blurb": "Mortgages secured on owner-occupied property, including home equity lines.",
      "columns": [
        "Home mortgages"
      ]
    },
    {
      "key": "consumer_credit",
      "label": "Consumer Credit",
      "blurb": "Credit cards, car loans, student loans and other unsecured consumer borrowing.",
      "columns": [
        "Consumer credit"
      ]
    },
    {
      "key": "depository_loans",
      "label": "Bank Loans",
      "blurb": "Loans from banks and other depository institutions not classified elsewhere.",
      "columns": [
        "Depository institutions loans n.e.c."
      ]
    },
    {
      "key": "other_loans",
      "label": "Other Loans",
      "blurb": "Margin loans, policy loans and other borrowing outside the categories above.",
      "columns": [
        "Other loans and advances (Liabilities)"
      ]
    },
    {
      "key": "deferred_premiums",
      "label": "Deferred Life Premiums",
      "blurb": "Life insurance premiums owed but not yet paid -- the one liability outside the loan tree.",
      "columns": [
        "Deferred and unpaid life insurance premiums"
      ]
    }
  ],
  "groups": {
    "top01": {
      "key": "top01",
      "label": "Top 0.1%",
      "percentile_range": "99.9th-100th",
      "nested": true,
      "nested_in": "top1",
      "period": "2026-04-01",
      "complete": true,
      "unavailable": [],
      "total_assets": 28168034000000.0,
      "total_liabilities": 300943000000.0,
      "net_worth": 27867091000000.0,
      "assets": {
        "corporate_equities": 16153923000000.0,
        "private_business": 4780991000000.0,
        "pension": 460715000000.0,
        "real_estate": 1966460000000.0,
        "deposits": 1448311000000.0,
        "money_market": 984940000000.0,
        "debt_securities": 1090909000000.0,
        "consumer_durables": 740398000000.0,
        "annuities": 68964000000.0,
        "life_insurance": 228630000000.0,
        "loans_assets": 197273000000.0,
        "misc_assets": 46521000000.0,
        "unallocated": 0.0
      },
      "liabilities": {
        "home_mortgages": 117243000000.0,
        "consumer_credit": 52381000000.0,
        "depository_loans": 17038000000.0,
        "other_loans": 111624000000.0,
        "deferred_premiums": 2656000000.0
      },
      "household_count": 136779.0,
      "threshold": {
        "field": "minimum_wealth_cutoff",
        "value": 45796944.0,
        "period": "2022-07-01"
      },
      "complete_snapshot": {
        "period": "2026-04-01",
        "assets": {
          "corporate_equities": 16153923000000.0,
          "private_business": 4780991000000.0,
          "pension": 460715000000.0,
          "real_estate": 1966460000000.0,
          "deposits": 1448311000000.0,
          "money_market": 984940000000.0,
          "debt_securities": 1090909000000.0,
          "consumer_durables": 740398000000.0,
          "annuities": 68964000000.0,
          "life_insurance": 228630000000.0,
          "loans_assets": 197273000000.0,
          "misc_assets": 46521000000.0,
          "unallocated": 0.0
        },
        "total_assets": 28168034000000.0,
        "total_liabilities": 300943000000.0,
        "net_worth": 27867091000000.0
      }
    },
    "top1": {
      "key": "top1",
      "label": "Top 1%",
      "percentile_range": "99th-100th",
      "nested": false,
      "nested_in": null,
      "period": "2026-04-01",
      "complete": true,
      "unavailable": [],
      "total_assets": 61502966000000.0,
      "total_liabilities": 1189942000000.0,
      "net_worth": 60313023000000.0,
      "assets": {
        "corporate_equities": 32889546000000.0,
        "private_business": 8886029000000.0,
        "pension": 2933061000000.0,
        "real_estate": 6672380000000.0,
        "deposits": 3323113000000.0,
        "money_market": 1957779000000.0,
        "debt_securities": 2216325000000.0,
        "consumer_durables": 1162184000000.0,
        "annuities": 309636000000.0,
        "life_insurance": 639838000000.0,
        "loans_assets": 366752000000.0,
        "misc_assets": 146325000000.0,
        "unallocated": 0.0
      },
      "liabilities": {
        "home_mortgages": 570336000000.0,
        "consumer_credit": 163567000000.0,
        "depository_loans": 171878000000.0,
        "other_loans": 272696000000.0,
        "deferred_premiums": 11464000000.0
      },
      "household_count": 1351004.0,
      "threshold": {
        "field": "minimum_wealth_cutoff",
        "value": 11007198.0,
        "period": "2022-07-01"
      },
      "complete_snapshot": {
        "period": "2026-04-01",
        "assets": {
          "corporate_equities": 32889546000000.0,
          "private_business": 8886029000000.0,
          "pension": 2933061000000.0,
          "real_estate": 6672380000000.0,
          "deposits": 3323113000000.0,
          "money_market": 1957779000000.0,
          "debt_securities": 2216325000000.0,
          "consumer_durables": 1162184000000.0,
          "annuities": 309636000000.0,
          "life_insurance": 639838000000.0,
          "loans_assets": 366752000000.0,
          "misc_assets": 146325000000.0,
          "unallocated": 0.0
        },
        "total_assets": 61502966000000.0,
        "total_liabilities": 1189942000000.0,
        "net_worth": 60313023000000.0
      }
    },
    "next9": {
      "key": "next9",
      "label": "Next 9%",
      "percentile_range": "90th-99th",
      "nested": false,
      "nested_in": null,
      "period": "2026-04-01",
      "complete": true,
      "unavailable": [],
      "total_assets": 71849146000000.0,
      "total_liabilities": 4215067000000.0,
      "net_worth": 67634079000000.0,
      "assets": {
        "corporate_equities": 24014368000000.0,
        "private_business": 5328226000000.0,
        "pension": 13311559000000.0,
        "real_estate": 15083366000000.0,
        "deposits": 5014713000000.0,
        "money_market": 2075552000000.0,
        "debt_securities": 2335425000000.0,
        "consumer_durables": 1918467000000.0,
        "annuities": 1407704000000.0,
        "life_insurance": 684262000000.0,
        "loans_assets": 266944000000.0,
        "misc_assets": 408560000000.0,
        "unallocated": 0.0
      },
      "liabilities": {
        "home_mortgages": 3410241000000.0,
        "consumer_credit": 524901000000.0,
        "depository_loans": 60745000000.0,
        "other_loans": 205266000000.0,
        "deferred_premiums": 13915000000.0
      },
      "household_count": 12165969.0,
      "threshold": {
        "field": "minimum_wealth_cutoff",
        "value": 2135868.0,
        "period": "2022-07-01"
      },
      "complete_snapshot": {
        "period": "2026-04-01",
        "assets": {
          "corporate_equities": 24014368000000.0,
          "private_business": 5328226000000.0,
          "pension": 13311559000000.0,
          "real_estate": 15083366000000.0,
          "deposits": 5014713000000.0,
          "money_market": 2075552000000.0,
          "debt_securities": 2335425000000.0,
          "consumer_durables": 1918467000000.0,
          "annuities": 1407704000000.0,
          "life_insurance": 684262000000.0,
          "loans_assets": 266944000000.0,
          "misc_assets": 408560000000.0,
          "unallocated": 0.0
        },
        "total_assets": 71849146000000.0,
        "total_liabilities": 4215067000000.0,
        "net_worth": 67634079000000.0
      }
    },
    "next40": {
      "key": "next40",
      "label": "Next 40%",
      "percentile_range": "50th-90th",
      "nested": false,
      "nested_in": null,
      "period": "2026-04-01",
      "complete": true,
      "unavailable": [],
      "total_assets": 62317685000000.0,
      "total_liabilities": 8891801000000.0,
      "net_worth": 53425884000000.0,
      "assets": {
        "corporate_equities": 7362060000000.0,
        "private_business": 2371758000000.0,
        "pension": 15305419000000.0,
        "real_estate": 23214769000000.0,
        "deposits": 5090389000000.0,
        "money_market": 1021646000000.0,
        "debt_securities": 1158965000000.0,
        "consumer_durables": 3864458000000.0,
        "annuities": 1154806000000.0,
        "life_insurance": 722784000000.0,
        "loans_assets": 127652000000.0,
        "misc_assets": 922980000000.0,
        "unallocated": 0.0
      },
      "liabilities": {
        "home_mortgages": 6836034000000.0,
        "consumer_credit": 1787916000000.0,
        "depository_loans": 147269000000.0,
        "other_loans": 105823000000.0,
        "deferred_premiums": 14760000000.0
      },
      "household_count": 54064877.0,
      "threshold": {
        "field": "minimum_wealth_cutoff",
        "value": 240508.0,
        "period": "2022-07-01"
      },
      "complete_snapshot": {
        "period": "2026-04-01",
        "assets": {
          "corporate_equities": 7362060000000.0,
          "private_business": 2371758000000.0,
          "pension": 15305419000000.0,
          "real_estate": 23214769000000.0,
          "deposits": 5090389000000.0,
          "money_market": 1021646000000.0,
          "debt_securities": 1158965000000.0,
          "consumer_durables": 3864458000000.0,
          "annuities": 1154806000000.0,
          "life_insurance": 722784000000.0,
          "loans_assets": 127652000000.0,
          "misc_assets": 922980000000.0,
          "unallocated": 0.0
        },
        "total_assets": 62317685000000.0,
        "total_liabilities": 8891801000000.0,
        "net_worth": 53425884000000.0
      }
    },
    "bottom50": {
      "key": "bottom50",
      "label": "Bottom 50%",
      "percentile_range": "0-50th",
      "nested": false,
      "nested_in": null,
      "period": "2026-04-01",
      "complete": true,
      "unavailable": [],
      "total_assets": 10272832000000.0,
      "total_liabilities": 5994794000000.0,
      "net_worth": 4278038000000.0,
      "assets": {
        "corporate_equities": 374196000000.0,
        "private_business": 168117000000.0,
        "pension": 1246740000000.0,
        "real_estate": 4821163000000.0,
        "deposits": 777430000000.0,
        "money_market": 55950000000.0,
        "debt_securities": 32798000000.0,
        "consumer_durables": 2169713000000.0,
        "annuities": 59362000000.0,
        "life_insurance": 169177000000.0,
        "loans_assets": 2474000000.0,
        "misc_assets": 395711000000.0,
        "unallocated": 1000000.0
      },
      "liabilities": {
        "home_mortgages": 3160326000000.0,
        "consumer_credit": 2643874000000.0,
        "depository_loans": 144390000000.0,
        "other_loans": 42513000000.0,
        "deferred_premiums": 3691000000.0
      },
      "household_count": 67616544.0,
      "threshold": null,
      "complete_snapshot": {
        "period": "2026-04-01",
        "assets": {
          "corporate_equities": 374196000000.0,
          "private_business": 168117000000.0,
          "pension": 1246740000000.0,
          "real_estate": 4821163000000.0,
          "deposits": 777430000000.0,
          "money_market": 55950000000.0,
          "debt_securities": 32798000000.0,
          "consumer_durables": 2169713000000.0,
          "annuities": 59362000000.0,
          "life_insurance": 169177000000.0,
          "loans_assets": 2474000000.0,
          "misc_assets": 395711000000.0,
          "unallocated": 1000000.0
        },
        "total_assets": 10272832000000.0,
        "total_liabilities": 5994794000000.0,
        "net_worth": 4278038000000.0
      }
    }
  },
  "trends": {
    "corporate_equities": {
      "top01": [
        {
          "period": "1989-07-01",
          "share": 0.1694
        },
        {
          "period": "1990-07-01",
          "share": 0.11706
        },
        {
          "period": "1991-07-01",
          "share": 0.18792
        },
        {
          "period": "1992-07-01",
          "share": 0.24244
        },
        {
          "period": "1993-07-01",
          "share": 0.27382
        },
        {
          "period": "1994-07-01",
          "share": 0.23906
        },
        {
          "period": "1995-07-01",
          "share": 0.26261
        },
        {
          "period": "1996-07-01",
          "share": 0.29622
        },
        {
          "period": "1997-07-01",
          "share": 0.36935
        },
        {
          "period": "1998-07-01",
          "share": 0.3666
        },
        {
          "period": "1999-07-01",
          "share": 0.39607
        },
        {
          "period": "2000-07-01",
          "share": 0.41885
        },
        {
          "period": "2001-07-01",
          "share": 0.26423
        },
        {
          "period": "2002-07-01",
          "share": 0.22652
        },
        {
          "period": "2003-07-01",
          "share": 0.30028
        },
        {
          "period": "2004-07-01",
          "share": 0.32364
        },
        {
          "period": "2005-07-01",
          "share": 0.34482
        },
        {
          "period": "2006-07-01",
          "share": 0.36807
        },
        {
          "period": "2007-07-01",
          "share": 0.39755
        },
        {
          "period": "2008-07-01",
          "share": 0.30585
        },
        {
          "period": "2009-07-01",
          "share": 0.33182
        },
        {
          "period": "2010-07-01",
          "share": 0.34969
        },
        {
          "period": "2011-07-01",
          "share": 0.33092
        },
        {
          "period": "2012-07-01",
          "share": 0.37674
        },
        {
          "period": "2013-07-01",
          "share": 0.42467
        },
        {
          "period": "2014-07-01",
          "share": 0.45064
        },
        {
          "period": "2015-07-01",
          "share": 0.42147
        },
        {
          "period": "2016-07-01",
          "share": 0.44081
        },
        {
          "period": "2017-07-01",
          "share": 0.45898
        },
        {
          "period": "2018-07-01",
          "share": 0.46963
        },
        {
          "period": "2019-07-01",
          "share": 0.44791
        },
        {
          "period": "2020-07-01",
          "share": 0.45392
        },
        {
          "period": "2021-07-01",
          "share": 0.50977
        },
        {
          "period": "2022-07-01",
          "share": 0.41679
        },
        {
          "period": "2023-07-01",
          "share": 0.44266
        },
        {
          "period": "2024-07-01",
          "share": 0.50785
        },
        {
          "period": "2025-07-01",
          "share": 0.53705
        }
      ],
      "top1": [
        {
          "period": "1989-07-01",
          "share": 0.1869
        },
        {
          "period": "1990-07-01",
          "share": 0.14387
        },
        {
          "period": "1991-07-01",
          "share": 0.19016
        },
        {
          "period": "1992-07-01",
          "share": 0.22478
        },
        {
          "period": "1993-07-01",
          "share": 0.27004
        },
        {
          "period": "1994-07-01",
          "share": 0.25878
        },
        {
          "period": "1995-07-01",
          "share": 0.28734
        },
        {
          "period": "1996-07-01",
          "share": 0.30373
        },
        {
          "period": "1997-07-01",
          "share": 0.35247
        },
        {
          "period": "1998-07-01",
          "share": 0.34161
        },
        {
          "period": "1999-07-01",
          "share": 0.3622
        },
        {
          "period": "2000-07-01",
          "share": 0.37712
        },
        {
          "period": "2001-07-01",
          "share": 0.25769
        },
        {
          "period": "2002-07-01",
          "share": 0.22043
        },
        {
          "period": "2003-07-01",
          "share": 0.26825
        },
        {
          "period": "2004-07-01",
          "share": 0.28213
        },
        {
          "period": "2005-07-01",
          "share": 0.30253
        },
        {
          "period": "2006-07-01",
          "share": 0.32495
        },
        {
          "period": "2007-07-01",
          "share": 0.35444
        },
        {
          "period": "2008-07-01",
          "share": 0.28051
        },
        {
          "period": "2009-07-01",
          "share": 0.29316
        },
        {
          "period": "2010-07-01",
          "share": 0.3081
        },
        {
          "period": "2011-07-01",
          "share": 0.29109
        },
        {
          "period": "2012-07-01",
          "share": 0.32538
        },
        {
          "period": "2013-07-01",
          "share": 0.36128
        },
        {
          "period": "2014-07-01",
          "share": 0.38707
        },
        {
          "period": "2015-07-01",
          "share": 0.36746
        },
        {
          "period": "2016-07-01",
          "share": 0.38592
        },
        {
          "period": "2017-07-01",
          "share": 0.41316
        },
        {
          "period": "2018-07-01",
          "share": 0.43352
        },
        {
          "period": "2019-07-01",
          "share": 0.42847
        },
        {
          "period": "2020-07-01",
          "share": 0.42667
        },
        {
          "period": "2021-07-01",
          "share": 0.47322
        },
        {
          "period": "2022-07-01",
          "share": 0.39082
        },
        {
          "period": "2023-07-01",
          "share": 0.41333
        },
        {
          "period": "2024-07-01",
          "share": 0.47111
        },
        {
          "period": "2025-07-01",
          "share": 0.4995
        }
      ],
      "next9": [
        {
          "period": "1989-07-01",
          "share": 0.09839
        },
        {
          "period": "1990-07-01",
          "share": 0.08063
        },
        {
          "period": "1991-07-01",
          "share": 0.10274
        },
        {
          "period": "1992-07-01",
          "share": 0.11632
        },
        {
          "period": "1993-07-01",
          "share": 0.13353
        },
        {
          "period": "1994-07-01",
          "share": 0.12526
        },
        {
          "period": "1995-07-01",
          "share": 0.14241
        },
        {
          "period": "1996-07-01",
          "share": 0.1554
        },
        {
          "period": "1997-07-01",
          "share": 0.18497
        },
        {
          "period": "1998-07-01",
          "share": 0.18187
        },
        {
          "period": "1999-07-01",
          "share": 0.20838
        },
        {
          "period": "2000-07-01",
          "share": 0.22785
        },
        {
          "period": "2001-07-01",
          "share": 0.16844
        },
        {
          "period": "2002-07-01",
          "share": 0.13589
        },
        {
          "period": "2003-07-01",
          "share": 0.1503
        },
        {
          "period": "2004-07-01",
          "share": 0.15143
        },
        {
          "period": "2005-07-01",
          "share": 0.15854
        },
        {
          "period": "2006-07-01",
          "share": 0.16773
        },
        {
          "period": "2007-07-01",
          "share": 0.1826
        },
        {
          "period": "2008-07-01",
          "share": 0.14625
        },
        {
          "period": "2009-07-01",
          "share": 0.15201
        },
        {
          "period": "2010-07-01",
          "share": 0.16327
        },
        {
          "period": "2011-07-01",
          "share": 0.157
        },
        {
          "period": "2012-07-01",
          "share": 0.17812
        },
        {
          "period": "2013-07-01",
          "share": 0.19364
        },
        {
          "period": "2014-07-01",
          "share": 0.20409
        },
        {
          "period": "2015-07-01",
          "share": 0.18962
        },
        {
          "period": "2016-07-01",
          "share": 0.19766
        },
        {
          "period": "2017-07-01",
          "share": 0.21079
        },
        {
          "period": "2018-07-01",
          "share": 0.22073
        },
        {
          "period": "2019-07-01",
          "share": 0.21542
        },
        {
          "period": "2020-07-01",
          "share": 0.2275
        },
        {
          "period": "2021-07-01",
          "share": 0.27285
        },
        {
          "period": "2022-07-01",
          "share": 0.23009
        },
        {
          "period": "2023-07-01",
          "share": 0.24425
        },
        {
          "period": "2024-07-01",
          "share": 0.28296
        },
        {
          "period": "2025-07-01",
          "share": 0.30557
        }
      ],
      "next40": [
        {
          "period": "1989-07-01",
          "share": 0.04063
        },
        {
          "period": "1990-07-01",
          "share": 0.03828
        },
        {
          "period": "1991-07-01",
          "share": 0.04824
        },
        {
          "period": "1992-07-01",
          "share": 0.05552
        },
        {
          "period": "1993-07-01",
          "share": 0.0585
        },
        {
          "period": "1994-07-01",
          "share": 0.05427
        },
        {
          "period": "1995-07-01",
          "share": 0.05675
        },
        {
          "period": "1996-07-01",
          "share": 0.06598
        },
        {
          "period": "1997-07-01",
          "share": 0.08009
        },
        {
          "period": "1998-07-01",
          "share": 0.08388
        },
        {
          "period": "1999-07-01",
          "share": 0.09571
        },
        {
          "period": "2000-07-01",
          "share": 0.10371
        },
        {
          "period": "2001-07-01",
          "share": 0.0815
        },
        {
          "period": "2002-07-01",
          "share": 0.0675
        },
        {
          "period": "2003-07-01",
          "share": 0.07065
        },
        {
          "period": "2004-07-01",
          "share": 0.06806
        },
        {
          "period": "2005-07-01",
          "share": 0.06807
        },
        {
          "period": "2006-07-01",
          "share": 0.06891
        },
        {
          "period": "2007-07-01",
          "share": 0.07236
        },
        {
          "period": "2008-07-01",
          "share": 0.05996
        },
        {
          "period": "2009-07-01",
          "share": 0.06114
        },
        {
          "period": "2010-07-01",
          "share": 0.06505
        },
        {
          "period": "2011-07-01",
          "share": 0.06622
        },
        {
          "period": "2012-07-01",
          "share": 0.07686
        },
        {
          "period": "2013-07-01",
          "share": 0.08436
        },
        {
          "period": "2014-07-01",
          "share": 0.08657
        },
        {
          "period": "2015-07-01",
          "share": 0.08015
        },
        {
          "period": "2016-07-01",
          "share": 0.08124
        },
        {
          "period": "2017-07-01",
          "share": 0.0832
        },
        {
          "period": "2018-07-01",
          "share": 0.08432
        },
        {
          "period": "2019-07-01",
          "share": 0.08022
        },
        {
          "period": "2020-07-01",
          "share": 0.08308
        },
        {
          "period": "2021-07-01",
          "share": 0.0971
        },
        {
          "period": "2022-07-01",
          "share": 0.0792
        },
        {
          "period": "2023-07-01",
          "share": 0.08395
        },
        {
          "period": "2024-07-01",
          "share": 0.09775
        },
        {
          "period": "2025-07-01",
          "share": 0.10689
        }
      ],
      "bottom50": [
        {
          "period": "1989-07-01",
          "share": 0.01405
        },
        {
          "period": "1990-07-01",
          "share": 0.01398
        },
        {
          "period": "1991-07-01",
          "share": 0.0179
        },
        {
          "period": "1992-07-01",
          "share": 0.02075
        },
        {
          "period": "1993-07-01",
          "share": 0.02344
        },
        {
          "period": "1994-07-01",
          "share": 0.02358
        },
        {
          "period": "1995-07-01",
          "share": 0.02421
        },
        {
          "period": "1996-07-01",
          "share": 0.02946
        },
        {
          "period": "1997-07-01",
          "share": 0.03614
        },
        {
          "period": "1998-07-01",
          "share": 0.0388
        },
        {
          "period": "1999-07-01",
          "share": 0.03879
        },
        {
          "period": "2000-07-01",
          "share": 0.03875
        },
        {
          "period": "2001-07-01",
          "share": 0.02928
        },
        {
          "period": "2002-07-01",
          "share": 0.02244
        },
        {
          "period": "2003-07-01",
          "share": 0.02103
        },
        {
          "period": "2004-07-01",
          "share": 0.01742
        },
        {
          "period": "2005-07-01",
          "share": 0.01868
        },
        {
          "period": "2006-07-01",
          "share": 0.02016
        },
        {
          "period": "2007-07-01",
          "share": 0.02305
        },
        {
          "period": "2008-07-01",
          "share": 0.01817
        },
        {
          "period": "2009-07-01",
          "share": 0.01713
        },
        {
          "period": "2010-07-01",
          "share": 0.01704
        },
        {
          "period": "2011-07-01",
          "share": 0.0167
        },
        {
          "period": "2012-07-01",
          "share": 0.01911
        },
        {
          "period": "2013-07-01",
          "share": 0.02054
        },
        {
          "period": "2014-07-01",
          "share": 0.02344
        },
        {
          "period": "2015-07-01",
          "share": 0.02275
        },
        {
          "period": "2016-07-01",
          "share": 0.02459
        },
        {
          "period": "2017-07-01",
          "share": 0.02524
        },
        {
          "period": "2018-07-01",
          "share": 0.02529
        },
        {
          "period": "2019-07-01",
          "share": 0.02303
        },
        {
          "period": "2020-07-01",
          "share": 0.02227
        },
        {
          "period": "2021-07-01",
          "share": 0.0267
        },
        {
          "period": "2022-07-01",
          "share": 0.01825
        },
        {
          "period": "2023-07-01",
          "share": 0.02091
        },
        {
          "period": "2024-07-01",
          "share": 0.02725
        },
        {
          "period": "2025-07-01",
          "share": 0.03106
        }
      ]
    },
    "private_business": {
      "top01": [
        {
          "period": "1989-07-01",
          "share": 0.32515
        },
        {
          "period": "1990-07-01",
          "share": 0.33921
        },
        {
          "period": "1991-07-01",
          "share": 0.30576
        },
        {
          "period": "1992-07-01",
          "share": 0.28965
        },
        {
          "period": "1993-07-01",
          "share": 0.25627
        },
        {
          "period": "1994-07-01",
          "share": 0.25631
        },
        {
          "period": "1995-07-01",
          "share": 0.24378
        },
        {
          "period": "1996-07-01",
          "share": 0.23421
        },
        {
          "period": "1997-07-01",
          "share": 0.22894
        },
        {
          "period": "1998-07-01",
          "share": 0.23583
        },
        {
          "period": "1999-07-01",
          "share": 0.23291
        },
        {
          "period": "2000-07-01",
          "share": 0.23566
        },
        {
          "period": "2001-07-01",
          "share": 0.28313
        },
        {
          "period": "2002-07-01",
          "share": 0.29024
        },
        {
          "period": "2003-07-01",
          "share": 0.25514
        },
        {
          "period": "2004-07-01",
          "share": 0.25405
        },
        {
          "period": "2005-07-01",
          "share": 0.26872
        },
        {
          "period": "2006-07-01",
          "share": 0.27043
        },
        {
          "period": "2007-07-01",
          "share": 0.2508
        },
        {
          "period": "2008-07-01",
          "share": 0.23168
        },
        {
          "period": "2009-07-01",
          "share": 0.17302
        },
        {
          "period": "2010-07-01",
          "share": 0.17649
        },
        {
          "period": "2011-07-01",
          "share": 0.19575
        },
        {
          "period": "2012-07-01",
          "share": 0.20574
        },
        {
          "period": "2013-07-01",
          "share": 0.23444
        },
        {
          "period": "2014-07-01",
          "share": 0.23433
        },
        {
          "period": "2015-07-01",
          "share": 0.25562
        },
        {
          "period": "2016-07-01",
          "share": 0.24806
        },
        {
          "period": "2017-07-01",
          "share": 0.25216
        },
        {
          "period": "2018-07-01",
          "share": 0.25433
        },
        {
          "period": "2019-07-01",
          "share": 0.27096
        },
        {
          "period": "2020-07-01",
          "share": 0.252
        },
        {
          "period": "2021-07-01",
          "share": 0.22721
        },
        {
          "period": "2022-07-01",
          "share": 0.26477
        },
        {
          "period": "2023-07-01",
          "share": 0.2392
        },
        {
          "period": "2024-07-01",
          "share": 0.20077
        },
        {
          "period": "2025-07-01",
          "share": 0.18624
        }
      ],
      "top1": [
        {
          "period": "1989-07-01",
          "share": 0.27332
        },
        {
          "period": "1990-07-01",
          "share": 0.28048
        },
        {
          "period": "1991-07-01",
          "share": 0.2566
        },
        {
          "period": "1992-07-01",
          "share": 0.244
        },
        {
          "period": "1993-07-01",
          "share": 0.23363
        },
        {
          "period": "1994-07-01",
          "share": 0.24237
        },
        {
          "period": "1995-07-01",
          "share": 0.23809
        },
        {
          "period": "1996-07-01",
          "share": 0.22376
        },
        {
          "period": "1997-07-01",
          "share": 0.21017
        },
        {
          "period": "1998-07-01",
          "share": 0.20752
        },
        {
          "period": "1999-07-01",
          "share": 0.20318
        },
        {
          "period": "2000-07-01",
          "share": 0.20201
        },
        {
          "period": "2001-07-01",
          "share": 0.23382
        },
        {
          "period": "2002-07-01",
          "share": 0.24475
        },
        {
          "period": "2003-07-01",
          "share": 0.22808
        },
        {
          "period": "2004-07-01",
          "share": 0.2277
        },
        {
          "period": "2005-07-01",
          "share": 0.22602
        },
        {
          "period": "2006-07-01",
          "share": 0.22065
        },
        {
          "period": "2007-07-01",
          "share": 0.2043
        },
        {
          "period": "2008-07-01",
          "share": 0.19714
        },
        {
          "period": "2009-07-01",
          "share": 0.16213
        },
        {
          "period": "2010-07-01",
          "share": 0.16602
        },
        {
          "period": "2011-07-01",
          "share": 0.17011
        },
        {
          "period": "2012-07-01",
          "share": 0.16831
        },
        {
          "period": "2013-07-01",
          "share": 0.17922
        },
        {
          "period": "2014-07-01",
          "share": 0.1841
        },
        {
          "period": "2015-07-01",
          "share": 0.20253
        },
        {
          "period": "2016-07-01",
          "share": 0.2006
        },
        {
          "period": "2017-07-01",
          "share": 0.19651
        },
        {
          "period": "2018-07-01",
          "share": 0.19135
        },
        {
          "period": "2019-07-01",
          "share": 0.19535
        },
        {
          "period": "2020-07-01",
          "share": 0.19244
        },
        {
          "period": "2021-07-01",
          "share": 0.18292
        },
        {
          "period": "2022-07-01",
          "share": 0.21693
        },
        {
          "period": "2023-07-01",
          "share": 0.19762
        },
        {
          "period": "2024-07-01",
          "share": 0.16829
        },
        {
          "period": "2025-07-01",
          "share": 0.15739
        }
      ],
      "next9": [
        {
          "period": "1989-07-01",
          "share": 0.12316
        },
        {
          "period": "1990-07-01",
          "share": 0.12564
        },
        {
          "period": "1991-07-01",
          "share": 0.12028
        },
        {
          "period": "1992-07-01",
          "share": 0.11372
        },
        {
          "period": "1993-07-01",
          "share": 0.10628
        },
        {
          "period": "1994-07-01",
          "share": 0.10462
        },
        {
          "period": "1995-07-01",
          "share": 0.10016
        },
        {
          "period": "1996-07-01",
          "share": 0.10175
        },
        {
          "period": "1997-07-01",
          "share": 0.10365
        },
        {
          "period": "1998-07-01",
          "share": 0.10864
        },
        {
          "period": "1999-07-01",
          "share": 0.10108
        },
        {
          "period": "2000-07-01",
          "share": 0.09654
        },
        {
          "period": "2001-07-01",
          "share": 0.1024
        },
        {
          "period": "2002-07-01",
          "share": 0.09919
        },
        {
          "period": "2003-07-01",
          "share": 0.09011
        },
        {
          "period": "2004-07-01",
          "share": 0.09231
        },
        {
          "period": "2005-07-01",
          "share": 0.10324
        },
        {
          "period": "2006-07-01",
          "share": 0.1107
        },
        {
          "period": "2007-07-01",
          "share": 0.11276
        },
        {
          "period": "2008-07-01",
          "share": 0.10285
        },
        {
          "period": "2009-07-01",
          "share": 0.08051
        },
        {
          "period": "2010-07-01",
          "share": 0.07888
        },
        {
          "period": "2011-07-01",
          "share": 0.08398
        },
        {
          "period": "2012-07-01",
          "share": 0.08793
        },
        {
          "period": "2013-07-01",
          "share": 0.09434
        },
        {
          "period": "2014-07-01",
          "share": 0.08831
        },
        {
          "period": "2015-07-01",
          "share": 0.089
        },
        {
          "period": "2016-07-01",
          "share": 0.08272
        },
        {
          "period": "2017-07-01",
          "share": 0.08426
        },
        {
          "period": "2018-07-01",
          "share": 0.08525
        },
        {
          "period": "2019-07-01",
          "share": 0.08929
        },
        {
          "period": "2020-07-01",
          "share": 0.08772
        },
        {
          "period": "2021-07-01",
          "share": 0.08756
        },
        {
          "period": "2022-07-01",
          "share": 0.10018
        },
        {
          "period": "2023-07-01",
          "share": 0.09242
        },
        {
          "period": "2024-07-01",
          "share": 0.08134
        },
        {
          "period": "2025-07-01",
          "share": 0.07819
        }
      ],
      "next40": [
        {
          "period": "1989-07-01",
          "share": 0.06824
        },
        {
          "period": "1990-07-01",
          "share": 0.06546
        },
        {
          "period": "1991-07-01",
          "share": 0.06147
        },
        {
          "period": "1992-07-01",
          "share": 0.05734
        },
        {
          "period": "1993-07-01",
          "share": 0.05545
        },
        {
          "period": "1994-07-01",
          "share": 0.05426
        },
        {
          "period": "1995-07-01",
          "share": 0.05247
        },
        {
          "period": "1996-07-01",
          "share": 0.05246
        },
        {
          "period": "1997-07-01",
          "share": 0.05282
        },
        {
          "period": "1998-07-01",
          "share": 0.05373
        },
        {
          "period": "1999-07-01",
          "share": 0.05314
        },
        {
          "period": "2000-07-01",
          "share": 0.05202
        },
        {
          "period": "2001-07-01",
          "share": 0.05272
        },
        {
          "period": "2002-07-01",
          "share": 0.05525
        },
        {
          "period": "2003-07-01",
          "share": 0.05595
        },
        {
          "period": "2004-07-01",
          "share": 0.05817
        },
        {
          "period": "2005-07-01",
          "share": 0.05391
        },
        {
          "period": "2006-07-01",
          "share": 0.05081
        },
        {
          "period": "2007-07-01",
          "share": 0.04789
        },
        {
          "period": "2008-07-01",
          "share": 0.0493
        },
        {
          "period": "2009-07-01",
          "share": 0.04686
        },
        {
          "period": "2010-07-01",
          "share": 0.0506
        },
        {
          "period": "2011-07-01",
          "share": 0.04917
        },
        {
          "period": "2012-07-01",
          "share": 0.04728
        },
        {
          "period": "2013-07-01",
          "share": 0.04536
        },
        {
          "period": "2014-07-01",
          "share": 0.04527
        },
        {
          "period": "2015-07-01",
          "share": 0.04698
        },
        {
          "period": "2016-07-01",
          "share": 0.04572
        },
        {
          "period": "2017-07-01",
          "share": 0.04427
        },
        {
          "period": "2018-07-01",
          "share": 0.04282
        },
        {
          "period": "2019-07-01",
          "share": 0.04268
        },
        {
          "period": "2020-07-01",
          "share": 0.04263
        },
        {
          "period": "2021-07-01",
          "share": 0.04268
        },
        {
          "period": "2022-07-01",
          "share": 0.04631
        },
        {
          "period": "2023-07-01",
          "share": 0.04362
        },
        {
          "period": "2024-07-01",
          "share": 0.04011
        },
        {
          "period": "2025-07-01",
          "share": 0.03941
        }
      ],
      "bottom50": [
        {
          "period": "1989-07-01",
          "share": 0.02363
        },
        {
          "period": "1990-07-01",
          "share": 0.0232
        },
        {
          "period": "1991-07-01",
          "share": 0.02262
        },
        {
          "period": "1992-07-01",
          "share": 0.02212
        },
        {
          "period": "1993-07-01",
          "share": 0.02252
        },
        {
          "period": "1994-07-01",
          "share": 0.02272
        },
        {
          "period": "1995-07-01",
          "share": 0.02168
        },
        {
          "period": "1996-07-01",
          "share": 0.02536
        },
        {
          "period": "1997-07-01",
          "share": 0.02794
        },
        {
          "period": "1998-07-01",
          "share": 0.03003
        },
        {
          "period": "1999-07-01",
          "share": 0.025
        },
        {
          "period": "2000-07-01",
          "share": 0.02048
        },
        {
          "period": "2001-07-01",
          "share": 0.01754
        },
        {
          "period": "2002-07-01",
          "share": 0.01898
        },
        {
          "period": "2003-07-01",
          "share": 0.01978
        },
        {
          "period": "2004-07-01",
          "share": 0.01967
        },
        {
          "period": "2005-07-01",
          "share": 0.02333
        },
        {
          "period": "2006-07-01",
          "share": 0.02652
        },
        {
          "period": "2007-07-01",
          "share": 0.03051
        },
        {
          "period": "2008-07-01",
          "share": 0.03221
        },
        {
          "period": "2009-07-01",
          "share": 0.03273
        },
        {
          "period": "2010-07-01",
          "share": 0.03301
        },
        {
          "period": "2011-07-01",
          "share": 0.03079
        },
        {
          "period": "2012-07-01",
          "share": 0.02688
        },
        {
          "period": "2013-07-01",
          "share": 0.02122
        },
        {
          "period": "2014-07-01",
          "share": 0.02191
        },
        {
          "period": "2015-07-01",
          "share": 0.02278
        },
        {
          "period": "2016-07-01",
          "share": 0.02291
        },
        {
          "period": "2017-07-01",
          "share": 0.02547
        },
        {
          "period": "2018-07-01",
          "share": 0.02757
        },
        {
          "period": "2019-07-01",
          "share": 0.02972
        },
        {
          "period": "2020-07-01",
          "share": 0.02564
        },
        {
          "period": "2021-07-01",
          "share": 0.02071
        },
        {
          "period": "2022-07-01",
          "share": 0.01786
        },
        {
          "period": "2023-07-01",
          "share": 0.0177
        },
        {
          "period": "2024-07-01",
          "share": 0.01723
        },
        {
          "period": "2025-07-01",
          "share": 0.01691
        }
      ]
    },
    "real_estate": {
      "top01": [
        {
          "period": "1989-07-01",
          "share": 0.07726
        },
        {
          "period": "1990-07-01",
          "share": 0.10309
        },
        {
          "period": "1991-07-01",
          "share": 0.11477
        },
        {
          "period": "1992-07-01",
          "share": 0.1332
        },
        {
          "period": "1993-07-01",
          "share": 0.10791
        },
        {
          "period": "1994-07-01",
          "share": 0.09039
        },
        {
          "period": "1995-07-01",
          "share": 0.06967
        },
        {
          "period": "1996-07-01",
          "share": 0.06958
        },
        {
          "period": "1997-07-01",
          "share": 0.06665
        },
        {
          "period": "1998-07-01",
          "share": 0.07061
        },
        {
          "period": "1999-07-01",
          "share": 0.07759
        },
        {
          "period": "2000-07-01",
          "share": 0.08455
        },
        {
          "period": "2001-07-01",
          "share": 0.11065
        },
        {
          "period": "2002-07-01",
          "share": 0.12964
        },
        {
          "period": "2003-07-01",
          "share": 0.12628
        },
        {
          "period": "2004-07-01",
          "share": 0.11778
        },
        {
          "period": "2005-07-01",
          "share": 0.11248
        },
        {
          "period": "2006-07-01",
          "share": 0.0996
        },
        {
          "period": "2007-07-01",
          "share": 0.08077
        },
        {
          "period": "2008-07-01",
          "share": 0.09319
        },
        {
          "period": "2009-07-01",
          "share": 0.10239
        },
        {
          "period": "2010-07-01",
          "share": 0.10118
        },
        {
          "period": "2011-07-01",
          "share": 0.09261
        },
        {
          "period": "2012-07-01",
          "share": 0.08204
        },
        {
          "period": "2013-07-01",
          "share": 0.08239
        },
        {
          "period": "2014-07-01",
          "share": 0.08127
        },
        {
          "period": "2015-07-01",
          "share": 0.08537
        },
        {
          "period": "2016-07-01",
          "share": 0.08466
        },
        {
          "period": "2017-07-01",
          "share": 0.08529
        },
        {
          "period": "2018-07-01",
          "share": 0.08456
        },
        {
          "period": "2019-07-01",
          "share": 0.08306
        },
        {
          "period": "2020-07-01",
          "share": 0.08305
        },
        {
          "period": "2021-07-01",
          "share": 0.0803
        },
        {
          "period": "2022-07-01",
          "share": 0.09771
        },
        {
          "period": "2023-07-01",
          "share": 0.09359
        },
        {
          "period": "2024-07-01",
          "share": 0.08381
        },
        {
          "period": "2025-07-01",
          "share": 0.07678
        }
      ],
      "top1": [
        {
          "period": "1989-07-01",
          "share": 0.12905
        },
        {
          "period": "1990-07-01",
          "share": 0.14644
        },
        {
          "period": "1991-07-01",
          "share": 0.14659
        },
        {
          "period": "1992-07-01",
          "share": 0.15657
        },
        {
          "period": "1993-07-01",
          "share": 0.13852
        },
        {
          "period": "1994-07-01",
          "share": 0.1272
        },
        {
          "period": "1995-07-01",
          "share": 0.10408
        },
        {
          "period": "1996-07-01",
          "share": 0.10681
        },
        {
          "period": "1997-07-01",
          "share": 0.10445
        },
        {
          "period": "1998-07-01",
          "share": 0.10963
        },
        {
          "period": "1999-07-01",
          "share": 0.11555
        },
        {
          "period": "2000-07-01",
          "share": 0.12312
        },
        {
          "period": "2001-07-01",
          "share": 0.15757
        },
        {
          "period": "2002-07-01",
          "share": 0.18568
        },
        {
          "period": "2003-07-01",
          "share": 0.18799
        },
        {
          "period": "2004-07-01",
          "share": 0.18557
        },
        {
          "period": "2005-07-01",
          "share": 0.18426
        },
        {
          "period": "2006-07-01",
          "share": 0.17194
        },
        {
          "period": "2007-07-01",
          "share": 0.14998
        },
        {
          "period": "2008-07-01",
          "share": 0.1535
        },
        {
          "period": "2009-07-01",
          "share": 0.14947
        },
        {
          "period": "2010-07-01",
          "share": 0.13938
        },
        {
          "period": "2011-07-01",
          "share": 0.1339
        },
        {
          "period": "2012-07-01",
          "share": 0.12546
        },
        {
          "period": "2013-07-01",
          "share": 0.12992
        },
        {
          "period": "2014-07-01",
          "share": 0.12842
        },
        {
          "period": "2015-07-01",
          "share": 0.13456
        },
        {
          "period": "2016-07-01",
          "share": 0.13419
        },
        {
          "period": "2017-07-01",
          "share": 0.13344
        },
        {
          "period": "2018-07-01",
          "share": 0.13169
        },
        {
          "period": "2019-07-01",
          "share": 0.12867
        },
        {
          "period": "2020-07-01",
          "share": 0.1268
        },
        {
          "period": "2021-07-01",
          "share": 0.12291
        },
        {
          "period": "2022-07-01",
          "share": 0.14356
        },
        {
          "period": "2023-07-01",
          "share": 0.13908
        },
        {
          "period": "2024-07-01",
          "share": 0.12666
        },
        {
          "period": "2025-07-01",
          "share": 0.11738
        }
      ],
      "next9": [
        {
          "period": "1989-07-01",
          "share": 0.2454
        },
        {
          "period": "1990-07-01",
          "share": 0.24619
        },
        {
          "period": "1991-07-01",
          "share": 0.23274
        },
        {
          "period": "1992-07-01",
          "share": 0.22522
        },
        {
          "period": "1993-07-01",
          "share": 0.22249
        },
        {
          "period": "1994-07-01",
          "share": 0.22416
        },
        {
          "period": "1995-07-01",
          "share": 0.2082
        },
        {
          "period": "1996-07-01",
          "share": 0.20315
        },
        {
          "period": "1997-07-01",
          "share": 0.19317
        },
        {
          "period": "1998-07-01",
          "share": 0.19592
        },
        {
          "period": "1999-07-01",
          "share": 0.19996
        },
        {
          "period": "2000-07-01",
          "share": 0.20537
        },
        {
          "period": "2001-07-01",
          "share": 0.23881
        },
        {
          "period": "2002-07-01",
          "share": 0.25727
        },
        {
          "period": "2003-07-01",
          "share": 0.25431
        },
        {
          "period": "2004-07-01",
          "share": 0.25744
        },
        {
          "period": "2005-07-01",
          "share": 0.26715
        },
        {
          "period": "2006-07-01",
          "share": 0.26338
        },
        {
          "period": "2007-07-01",
          "share": 0.24524
        },
        {
          "period": "2008-07-01",
          "share": 0.24163
        },
        {
          "period": "2009-07-01",
          "share": 0.22873
        },
        {
          "period": "2010-07-01",
          "share": 0.21489
        },
        {
          "period": "2011-07-01",
          "share": 0.2044
        },
        {
          "period": "2012-07-01",
          "share": 0.1937
        },
        {
          "period": "2013-07-01",
          "share": 0.19338
        },
        {
          "period": "2014-07-01",
          "share": 0.19334
        },
        {
          "period": "2015-07-01",
          "share": 0.20024
        },
        {
          "period": "2016-07-01",
          "share": 0.20006
        },
        {
          "period": "2017-07-01",
          "share": 0.20037
        },
        {
          "period": "2018-07-01",
          "share": 0.19982
        },
        {
          "period": "2019-07-01",
          "share": 0.19596
        },
        {
          "period": "2020-07-01",
          "share": 0.20185
        },
        {
          "period": "2021-07-01",
          "share": 0.21458
        },
        {
          "period": "2022-07-01",
          "share": 0.25176
        },
        {
          "period": "2023-07-01",
          "share": 0.24611
        },
        {
          "period": "2024-07-01",
          "share": 0.23162
        },
        {
          "period": "2025-07-01",
          "share": 0.22048
        }
      ],
      "next40": [
        {
          "period": "1989-07-01",
          "share": 0.38706
        },
        {
          "period": "1990-07-01",
          "share": 0.37425
        },
        {
          "period": "1991-07-01",
          "share": 0.35375
        },
        {
          "period": "1992-07-01",
          "share": 0.34489
        },
        {
          "period": "1993-07-01",
          "share": 0.34726
        },
        {
          "period": "1994-07-01",
          "share": 0.35635
        },
        {
          "period": "1995-07-01",
          "share": 0.34604
        },
        {
          "period": "1996-07-01",
          "share": 0.33886
        },
        {
          "period": "1997-07-01",
          "share": 0.32381
        },
        {
          "period": "1998-07-01",
          "share": 0.32633
        },
        {
          "period": "1999-07-01",
          "share": 0.32328
        },
        {
          "period": "2000-07-01",
          "share": 0.33304
        },
        {
          "period": "2001-07-01",
          "share": 0.36689
        },
        {
          "period": "2002-07-01",
          "share": 0.38567
        },
        {
          "period": "2003-07-01",
          "share": 0.39214
        },
        {
          "period": "2004-07-01",
          "share": 0.40506
        },
        {
          "period": "2005-07-01",
          "share": 0.41717
        },
        {
          "period": "2006-07-01",
          "share": 0.4154
        },
        {
          "period": "2007-07-01",
          "share": 0.392
        },
        {
          "period": "2008-07-01",
          "share": 0.37275
        },
        {
          "period": "2009-07-01",
          "share": 0.34954
        },
        {
          "period": "2010-07-01",
          "share": 0.33062
        },
        {
          "period": "2011-07-01",
          "share": 0.31271
        },
        {
          "period": "2012-07-01",
          "share": 0.2984
        },
        {
          "period": "2013-07-01",
          "share": 0.30262
        },
        {
          "period": "2014-07-01",
          "share": 0.31093
        },
        {
          "period": "2015-07-01",
          "share": 0.32565
        },
        {
          "period": "2016-07-01",
          "share": 0.33526
        },
        {
          "period": "2017-07-01",
          "share": 0.3419
        },
        {
          "period": "2018-07-01",
          "share": 0.347
        },
        {
          "period": "2019-07-01",
          "share": 0.34091
        },
        {
          "period": "2020-07-01",
          "share": 0.33921
        },
        {
          "period": "2021-07-01",
          "share": 0.35684
        },
        {
          "period": "2022-07-01",
          "share": 0.38418
        },
        {
          "period": "2023-07-01",
          "share": 0.39203
        },
        {
          "period": "2024-07-01",
          "share": 0.38659
        },
        {
          "period": "2025-07-01",
          "share": 0.37694
        }
      ],
      "bottom50": [
        {
          "period": "1989-07-01",
          "share": 0.48431
        },
        {
          "period": "1990-07-01",
          "share": 0.47987
        },
        {
          "period": "1991-07-01",
          "share": 0.48376
        },
        {
          "period": "1992-07-01",
          "share": 0.49346
        },
        {
          "period": "1993-07-01",
          "share": 0.48611
        },
        {
          "period": "1994-07-01",
          "share": 0.4816
        },
        {
          "period": "1995-07-01",
          "share": 0.50387
        },
        {
          "period": "1996-07-01",
          "share": 0.48791
        },
        {
          "period": "1997-07-01",
          "share": 0.47649
        },
        {
          "period": "1998-07-01",
          "share": 0.48472
        },
        {
          "period": "1999-07-01",
          "share": 0.49213
        },
        {
          "period": "2000-07-01",
          "share": 0.49978
        },
        {
          "period": "2001-07-01",
          "share": 0.51339
        },
        {
          "period": "2002-07-01",
          "share": 0.52879
        },
        {
          "period": "2003-07-01",
          "share": 0.54356
        },
        {
          "period": "2004-07-01",
          "share": 0.56654
        },
        {
          "period": "2005-07-01",
          "share": 0.58285
        },
        {
          "period": "2006-07-01",
          "share": 0.5916
        },
        {
          "period": "2007-07-01",
          "share": 0.57222
        },
        {
          "period": "2008-07-01",
          "share": 0.55481
        },
        {
          "period": "2009-07-01",
          "share": 0.54355
        },
        {
          "period": "2010-07-01",
          "share": 0.5413
        },
        {
          "period": "2011-07-01",
          "share": 0.51089
        },
        {
          "period": "2012-07-01",
          "share": 0.49322
        },
        {
          "period": "2013-07-01",
          "share": 0.49677
        },
        {
          "period": "2014-07-01",
          "share": 0.49129
        },
        {
          "period": "2015-07-01",
          "share": 0.4909
        },
        {
          "period": "2016-07-01",
          "share": 0.49128
        },
        {
          "period": "2017-07-01",
          "share": 0.49158
        },
        {
          "period": "2018-07-01",
          "share": 0.4963
        },
        {
          "period": "2019-07-01",
          "share": 0.50072
        },
        {
          "period": "2020-07-01",
          "share": 0.497
        },
        {
          "period": "2021-07-01",
          "share": 0.50083
        },
        {
          "period": "2022-07-01",
          "share": 0.52004
        },
        {
          "period": "2023-07-01",
          "share": 0.51276
        },
        {
          "period": "2024-07-01",
          "share": 0.49888
        },
        {
          "period": "2025-07-01",
          "share": 0.48586
        }
      ]
    }
  }
}
