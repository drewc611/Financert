/* Embedded snapshot of the Federal Reserve Distributional Financial
   Accounts, generated from backend/data/dfa_snapshot.json. Lets the
   dashboard render when the API is unreachable. Regenerate with:
     python backend/tools/build_fallback.py
   Do not hand-edit. */

export const fallbackData = {
  "source": {
    "name": "Federal Reserve Distributional Financial Accounts",
    "publisher": "Board of Governors of the Federal Reserve System",
    "retrieved_via": "FRED (fred.stlouisfed.org)",
    "url": "https://www.federalreserve.gov/releases/z1/dataviz/dfa/",
    "retrieved_at": "2026-08-22T17:37:39+00:00",
    "units": "US dollars, not seasonally adjusted"
  },
  "latest_period": "2026-01-01",
  "latest_complete_period": "2024-07-01",
  "complete_periods": [
    "2014-10-01",
    "2015-01-01",
    "2015-04-01",
    "2015-07-01",
    "2015-10-01",
    "2016-01-01",
    "2016-04-01",
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
    "2024-07-01"
  ],
  "group_order": [
    "top1",
    "next9",
    "next40",
    "bottom50"
  ],
  "periods": [
    "2016-04-01",
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
    "2026-01-01"
  ],
  "asset_classes": [
    {
      "key": "corporate_equities",
      "label": "Stocks & Mutual Funds",
      "liquid": true,
      "blurb": "Directly held corporate equities plus mutual fund shares."
    },
    {
      "key": "private_business",
      "label": "Private Business Equity",
      "liquid": false,
      "blurb": "Ownership of noncorporate businesses -- partnerships, S-corps, sole proprietorships."
    },
    {
      "key": "pension",
      "label": "Pensions & Retirement",
      "liquid": false,
      "blurb": "Defined benefit and defined contribution pension entitlements."
    },
    {
      "key": "real_estate",
      "label": "Real Estate",
      "liquid": false,
      "blurb": "Owner-occupied housing and other real property."
    },
    {
      "key": "deposits",
      "label": "Cash & Deposits",
      "liquid": true,
      "blurb": "Checkable deposits, currency, time deposits and short-term investments."
    },
    {
      "key": "money_market",
      "label": "Money Market Funds",
      "liquid": true,
      "blurb": "Money market mutual fund shares."
    },
    {
      "key": "debt_securities",
      "label": "Bonds",
      "liquid": true,
      "blurb": "Treasury, municipal, corporate and foreign bonds held directly."
    },
    {
      "key": "consumer_durables",
      "label": "Consumer Durables",
      "liquid": false,
      "blurb": "Vehicles, appliances, furnishings -- counted as assets by the Fed, not investments."
    },
    {
      "key": "life_insurance",
      "label": "Life Insurance",
      "liquid": false,
      "blurb": "Cash value of life insurance reserves."
    },
    {
      "key": "loans_assets",
      "label": "Loans Receivable",
      "liquid": false,
      "blurb": "Mortgages and other loans held as assets."
    },
    {
      "key": "misc_assets",
      "label": "Other Assets",
      "liquid": false,
      "blurb": "Miscellaneous assets not classified elsewhere."
    },
    {
      "key": "unallocated",
      "label": "Unallocated",
      "liquid": false,
      "blurb": "Residual between the Fed's published asset total and the categories above, caused by a definitional change in the deposits series."
    }
  ],
  "groups": {
    "top01": {
      "key": "top01",
      "label": "Top 0.1%",
      "percentile_range": "99.9th-100th",
      "nested": true,
      "nested_in": "top1",
      "period": "2026-01-01",
      "complete": false,
      "unavailable": [
        "private_business"
      ],
      "total_assets": 25311992000000.0,
      "total_liabilities": 239711000000.0,
      "net_worth": 25072282000000.0,
      "assets": {
        "corporate_equities": 13331518000000.0,
        "pension": 453454000000.0,
        "real_estate": 1937284000000.0,
        "deposits": 1473775000000.0,
        "money_market": 1006257000000.0,
        "debt_securities": 1104402000000.0,
        "consumer_durables": 712377000000.0,
        "life_insurance": 232477000000.0,
        "loans_assets": 265014000000.0,
        "misc_assets": 44806000000.0,
        "unallocated": 4750628000000.0
      },
      "complete_snapshot": {
        "period": "2024-07-01",
        "assets": {
          "corporate_equities": 11433106000000.0,
          "private_business": 4385246000000.0,
          "pension": 436106000000.0,
          "real_estate": 1886606000000.0,
          "deposits": 1362909000000.0,
          "money_market": 745769000000.0,
          "debt_securities": 1051775000000.0,
          "consumer_durables": 622289000000.0,
          "life_insurance": 230710000000.0,
          "loans_assets": 313101000000.0,
          "misc_assets": 42100000000.0,
          "unallocated": 165353000000.0
        },
        "total_assets": 22675070000000.0,
        "total_liabilities": 233758000000.0,
        "net_worth": 22441312000000.0
      }
    },
    "top1": {
      "key": "top1",
      "label": "Top 1%",
      "percentile_range": "99th-100th",
      "nested": false,
      "nested_in": null,
      "period": "2026-01-01",
      "complete": false,
      "unavailable": [
        "private_business"
      ],
      "total_assets": 56042476000000.0,
      "total_liabilities": 1009477000000.0,
      "net_worth": 55033000000000.0,
      "assets": {
        "corporate_equities": 27643648000000.0,
        "pension": 2758346000000.0,
        "real_estate": 6484137000000.0,
        "deposits": 3420010000000.0,
        "money_market": 1991774000000.0,
        "debt_securities": 2255117000000.0,
        "consumer_durables": 1129619000000.0,
        "life_insurance": 622086000000.0,
        "loans_assets": 549701000000.0,
        "misc_assets": 139399000000.0,
        "unallocated": 9048639000000.0
      },
      "complete_snapshot": {
        "period": "2024-07-01",
        "assets": {
          "corporate_equities": 23862978000000.0,
          "private_business": 8218524000000.0,
          "pension": 2600227000000.0,
          "real_estate": 6295344000000.0,
          "deposits": 3180282000000.0,
          "money_market": 1522005000000.0,
          "debt_securities": 2156826000000.0,
          "consumer_durables": 1008502000000.0,
          "life_insurance": 617874000000.0,
          "loans_assets": 587618000000.0,
          "misc_assets": 131699000000.0,
          "unallocated": 485876000000.0
        },
        "total_assets": 50667755000000.0,
        "total_liabilities": 1058617000000.0,
        "net_worth": 49609139000000.0
      }
    },
    "next9": {
      "key": "next9",
      "label": "Next 9%",
      "percentile_range": "90th-99th",
      "nested": false,
      "nested_in": null,
      "period": "2026-01-01",
      "complete": false,
      "unavailable": [
        "private_business"
      ],
      "total_assets": 67334132000000.0,
      "total_liabilities": 4108736000000.0,
      "net_worth": 63225396000000.0,
      "assets": {
        "corporate_equities": 20514327000000.0,
        "pension": 12784682000000.0,
        "real_estate": 14762255000000.0,
        "deposits": 5054244000000.0,
        "money_market": 2055926000000.0,
        "debt_securities": 2386708000000.0,
        "consumer_durables": 1886084000000.0,
        "life_insurance": 667332000000.0,
        "loans_assets": 282903000000.0,
        "misc_assets": 389386000000.0,
        "unallocated": 6550285000000.0
      },
      "complete_snapshot": {
        "period": "2024-07-01",
        "assets": {
          "corporate_equities": 17853033000000.0,
          "private_business": 4911358000000.0,
          "pension": 12073949000000.0,
          "real_estate": 14321436000000.0,
          "deposits": 4786840000000.0,
          "money_market": 1693655000000.0,
          "debt_securities": 2288025000000.0,
          "consumer_durables": 1721449000000.0,
          "life_insurance": 662445000000.0,
          "loans_assets": 379916000000.0,
          "misc_assets": 367997000000.0,
          "unallocated": 1421750000000.0
        },
        "total_assets": 62481853000000.0,
        "total_liabilities": 3894046000000.0,
        "net_worth": 58587807000000.0
      }
    },
    "next40": {
      "key": "next40",
      "label": "Next 40%",
      "percentile_range": "50th-90th",
      "nested": false,
      "nested_in": null,
      "period": "2026-01-01",
      "complete": false,
      "unavailable": [
        "private_business"
      ],
      "total_assets": 60280256000000.0,
      "total_liabilities": 8795392000000.0,
      "net_worth": 51484864000000.0,
      "assets": {
        "corporate_equities": 6400950000000.0,
        "pension": 14761048000000.0,
        "real_estate": 22650205000000.0,
        "deposits": 5185020000000.0,
        "money_market": 1104304000000.0,
        "debt_securities": 1193186000000.0,
        "consumer_durables": 3773624000000.0,
        "life_insurance": 709094000000.0,
        "loans_assets": 126781000000.0,
        "misc_assets": 879571000000.0,
        "unallocated": 3496473000000.0
      },
      "complete_snapshot": {
        "period": "2024-07-01",
        "assets": {
          "corporate_equities": 5647158000000.0,
          "private_business": 2264464000000.0,
          "pension": 14021695000000.0,
          "real_estate": 21919258000000.0,
          "deposits": 4876393000000.0,
          "money_market": 937618000000.0,
          "debt_securities": 1145066000000.0,
          "consumer_durables": 3397182000000.0,
          "life_insurance": 702634000000.0,
          "loans_assets": 159336000000.0,
          "misc_assets": 828860000000.0,
          "unallocated": 1141506000000.0
        },
        "total_assets": 57041170000000.0,
        "total_liabilities": 8570021000000.0,
        "net_worth": 48471149000000.0
      }
    },
    "bottom50": {
      "key": "bottom50",
      "label": "Bottom 50%",
      "percentile_range": "0-50th",
      "nested": false,
      "nested_in": null,
      "period": "2026-01-01",
      "complete": false,
      "unavailable": [
        "private_business"
      ],
      "total_assets": 10348948000000.0,
      "total_liabilities": 6082588000000.0,
      "net_worth": 4266359000000.0,
      "assets": {
        "corporate_equities": 587223000000.0,
        "pension": 1175379000000.0,
        "real_estate": 4826745000000.0,
        "deposits": 793232000000.0,
        "money_market": 54257000000.0,
        "debt_securities": 28583000000.0,
        "consumer_durables": 2110476000000.0,
        "life_insurance": 169417000000.0,
        "loans_assets": 2728000000.0,
        "misc_assets": 375549000000.0,
        "unallocated": 225359000000.0
      },
      "complete_snapshot": {
        "period": "2024-07-01",
        "assets": {
          "corporate_equities": 501544000000.0,
          "private_business": 166192000000.0,
          "pension": 1102829000000.0,
          "real_estate": 4779469000000.0,
          "deposits": 742640000000.0,
          "money_market": 41326000000.0,
          "debt_securities": 28630000000.0,
          "consumer_durables": 1886247000000.0,
          "life_insurance": 167808000000.0,
          "loans_assets": 3539000000.0,
          "misc_assets": 353155000000.0,
          "unallocated": 55313000000.0
        },
        "total_assets": 9828692000000.0,
        "total_liabilities": 5942374000000.0,
        "net_worth": 3886317000000.0
      }
    }
  },
  "trends": {
    "corporate_equities": {
      "top01": [
        {
          "period": "1989-07-01",
          "share": 0.16942
        },
        {
          "period": "1990-07-01",
          "share": 0.11984
        },
        {
          "period": "1991-07-01",
          "share": 0.18896
        },
        {
          "period": "1992-07-01",
          "share": 0.24224
        },
        {
          "period": "1993-07-01",
          "share": 0.27371
        },
        {
          "period": "1994-07-01",
          "share": 0.23965
        },
        {
          "period": "1995-07-01",
          "share": 0.26148
        },
        {
          "period": "1996-07-01",
          "share": 0.29461
        },
        {
          "period": "1997-07-01",
          "share": 0.36603
        },
        {
          "period": "1998-07-01",
          "share": 0.36496
        },
        {
          "period": "1999-07-01",
          "share": 0.39217
        },
        {
          "period": "2000-07-01",
          "share": 0.41281
        },
        {
          "period": "2001-07-01",
          "share": 0.26277
        },
        {
          "period": "2002-07-01",
          "share": 0.22596
        },
        {
          "period": "2003-07-01",
          "share": 0.29979
        },
        {
          "period": "2004-07-01",
          "share": 0.3228
        },
        {
          "period": "2005-07-01",
          "share": 0.34362
        },
        {
          "period": "2006-07-01",
          "share": 0.36626
        },
        {
          "period": "2007-07-01",
          "share": 0.39639
        },
        {
          "period": "2008-07-01",
          "share": 0.31193
        },
        {
          "period": "2009-07-01",
          "share": 0.33235
        },
        {
          "period": "2010-07-01",
          "share": 0.34963
        },
        {
          "period": "2011-07-01",
          "share": 0.33274
        },
        {
          "period": "2012-07-01",
          "share": 0.37822
        },
        {
          "period": "2013-07-01",
          "share": 0.42185
        },
        {
          "period": "2014-07-01",
          "share": 0.44472
        },
        {
          "period": "2015-07-01",
          "share": 0.41738
        },
        {
          "period": "2016-07-01",
          "share": 0.4368
        },
        {
          "period": "2017-07-01",
          "share": 0.45618
        },
        {
          "period": "2018-07-01",
          "share": 0.46753
        },
        {
          "period": "2019-07-01",
          "share": 0.45071
        },
        {
          "period": "2020-07-01",
          "share": 0.4552
        },
        {
          "period": "2021-07-01",
          "share": 0.50807
        },
        {
          "period": "2022-07-01",
          "share": 0.41523
        },
        {
          "period": "2023-07-01",
          "share": 0.44134
        },
        {
          "period": "2024-07-01",
          "share": 0.50421
        },
        {
          "period": "2025-07-01",
          "share": 0.53265
        }
      ],
      "top1": [
        {
          "period": "1989-07-01",
          "share": 0.18691
        },
        {
          "period": "1990-07-01",
          "share": 0.1448
        },
        {
          "period": "1991-07-01",
          "share": 0.19071
        },
        {
          "period": "1992-07-01",
          "share": 0.22464
        },
        {
          "period": "1993-07-01",
          "share": 0.27052
        },
        {
          "period": "1994-07-01",
          "share": 0.25936
        },
        {
          "period": "1995-07-01",
          "share": 0.28721
        },
        {
          "period": "1996-07-01",
          "share": 0.30299
        },
        {
          "period": "1997-07-01",
          "share": 0.3508
        },
        {
          "period": "1998-07-01",
          "share": 0.34102
        },
        {
          "period": "1999-07-01",
          "share": 0.36002
        },
        {
          "period": "2000-07-01",
          "share": 0.37419
        },
        {
          "period": "2001-07-01",
          "share": 0.25704
        },
        {
          "period": "2002-07-01",
          "share": 0.21916
        },
        {
          "period": "2003-07-01",
          "share": 0.26774
        },
        {
          "period": "2004-07-01",
          "share": 0.28169
        },
        {
          "period": "2005-07-01",
          "share": 0.30173
        },
        {
          "period": "2006-07-01",
          "share": 0.32374
        },
        {
          "period": "2007-07-01",
          "share": 0.35397
        },
        {
          "period": "2008-07-01",
          "share": 0.28484
        },
        {
          "period": "2009-07-01",
          "share": 0.29248
        },
        {
          "period": "2010-07-01",
          "share": 0.30797
        },
        {
          "period": "2011-07-01",
          "share": 0.29229
        },
        {
          "period": "2012-07-01",
          "share": 0.32617
        },
        {
          "period": "2013-07-01",
          "share": 0.35922
        },
        {
          "period": "2014-07-01",
          "share": 0.38422
        },
        {
          "period": "2015-07-01",
          "share": 0.36569
        },
        {
          "period": "2016-07-01",
          "share": 0.38471
        },
        {
          "period": "2017-07-01",
          "share": 0.41242
        },
        {
          "period": "2018-07-01",
          "share": 0.43281
        },
        {
          "period": "2019-07-01",
          "share": 0.43165
        },
        {
          "period": "2020-07-01",
          "share": 0.42954
        },
        {
          "period": "2021-07-01",
          "share": 0.47437
        },
        {
          "period": "2022-07-01",
          "share": 0.39145
        },
        {
          "period": "2023-07-01",
          "share": 0.41425
        },
        {
          "period": "2024-07-01",
          "share": 0.47097
        },
        {
          "period": "2025-07-01",
          "share": 0.49778
        }
      ],
      "next9": [
        {
          "period": "1989-07-01",
          "share": 0.09839
        },
        {
          "period": "1990-07-01",
          "share": 0.08054
        },
        {
          "period": "1991-07-01",
          "share": 0.10267
        },
        {
          "period": "1992-07-01",
          "share": 0.11643
        },
        {
          "period": "1993-07-01",
          "share": 0.13334
        },
        {
          "period": "1994-07-01",
          "share": 0.12523
        },
        {
          "period": "1995-07-01",
          "share": 0.14248
        },
        {
          "period": "1996-07-01",
          "share": 0.15574
        },
        {
          "period": "1997-07-01",
          "share": 0.18539
        },
        {
          "period": "1998-07-01",
          "share": 0.18193
        },
        {
          "period": "1999-07-01",
          "share": 0.20874
        },
        {
          "period": "2000-07-01",
          "share": 0.22817
        },
        {
          "period": "2001-07-01",
          "share": 0.16829
        },
        {
          "period": "2002-07-01",
          "share": 0.1363
        },
        {
          "period": "2003-07-01",
          "share": 0.15039
        },
        {
          "period": "2004-07-01",
          "share": 0.15135
        },
        {
          "period": "2005-07-01",
          "share": 0.15859
        },
        {
          "period": "2006-07-01",
          "share": 0.168
        },
        {
          "period": "2007-07-01",
          "share": 0.18262
        },
        {
          "period": "2008-07-01",
          "share": 0.14529
        },
        {
          "period": "2009-07-01",
          "share": 0.15237
        },
        {
          "period": "2010-07-01",
          "share": 0.16333
        },
        {
          "period": "2011-07-01",
          "share": 0.15721
        },
        {
          "period": "2012-07-01",
          "share": 0.17855
        },
        {
          "period": "2013-07-01",
          "share": 0.19528
        },
        {
          "period": "2014-07-01",
          "share": 0.20491
        },
        {
          "period": "2015-07-01",
          "share": 0.19095
        },
        {
          "period": "2016-07-01",
          "share": 0.19885
        },
        {
          "period": "2017-07-01",
          "share": 0.21223
        },
        {
          "period": "2018-07-01",
          "share": 0.22234
        },
        {
          "period": "2019-07-01",
          "share": 0.21931
        },
        {
          "period": "2020-07-01",
          "share": 0.23167
        },
        {
          "period": "2021-07-01",
          "share": 0.2765
        },
        {
          "period": "2022-07-01",
          "share": 0.23302
        },
        {
          "period": "2023-07-01",
          "share": 0.24752
        },
        {
          "period": "2024-07-01",
          "share": 0.28573
        },
        {
          "period": "2025-07-01",
          "share": 0.30705
        }
      ],
      "next40": [
        {
          "period": "1989-07-01",
          "share": 0.04063
        },
        {
          "period": "1990-07-01",
          "share": 0.03807
        },
        {
          "period": "1991-07-01",
          "share": 0.04812
        },
        {
          "period": "1992-07-01",
          "share": 0.05548
        },
        {
          "period": "1993-07-01",
          "share": 0.05851
        },
        {
          "period": "1994-07-01",
          "share": 0.05423
        },
        {
          "period": "1995-07-01",
          "share": 0.05676
        },
        {
          "period": "1996-07-01",
          "share": 0.06601
        },
        {
          "period": "1997-07-01",
          "share": 0.08022
        },
        {
          "period": "1998-07-01",
          "share": 0.08391
        },
        {
          "period": "1999-07-01",
          "share": 0.0959
        },
        {
          "period": "2000-07-01",
          "share": 0.10398
        },
        {
          "period": "2001-07-01",
          "share": 0.08151
        },
        {
          "period": "2002-07-01",
          "share": 0.0674
        },
        {
          "period": "2003-07-01",
          "share": 0.07063
        },
        {
          "period": "2004-07-01",
          "share": 0.06806
        },
        {
          "period": "2005-07-01",
          "share": 0.06808
        },
        {
          "period": "2006-07-01",
          "share": 0.06895
        },
        {
          "period": "2007-07-01",
          "share": 0.07238
        },
        {
          "period": "2008-07-01",
          "share": 0.05987
        },
        {
          "period": "2009-07-01",
          "share": 0.06115
        },
        {
          "period": "2010-07-01",
          "share": 0.06507
        },
        {
          "period": "2011-07-01",
          "share": 0.066
        },
        {
          "period": "2012-07-01",
          "share": 0.07643
        },
        {
          "period": "2013-07-01",
          "share": 0.08414
        },
        {
          "period": "2014-07-01",
          "share": 0.08618
        },
        {
          "period": "2015-07-01",
          "share": 0.07988
        },
        {
          "period": "2016-07-01",
          "share": 0.0809
        },
        {
          "period": "2017-07-01",
          "share": 0.08313
        },
        {
          "period": "2018-07-01",
          "share": 0.08447
        },
        {
          "period": "2019-07-01",
          "share": 0.08153
        },
        {
          "period": "2020-07-01",
          "share": 0.08464
        },
        {
          "period": "2021-07-01",
          "share": 0.09865
        },
        {
          "period": "2022-07-01",
          "share": 0.08049
        },
        {
          "period": "2023-07-01",
          "share": 0.08529
        },
        {
          "period": "2024-07-01",
          "share": 0.099
        },
        {
          "period": "2025-07-01",
          "share": 0.10738
        }
      ],
      "bottom50": [
        {
          "period": "1989-07-01",
          "share": 0.01405
        },
        {
          "period": "1990-07-01",
          "share": 0.01252
        },
        {
          "period": "1991-07-01",
          "share": 0.01736
        },
        {
          "period": "1992-07-01",
          "share": 0.02077
        },
        {
          "period": "1993-07-01",
          "share": 0.02405
        },
        {
          "period": "1994-07-01",
          "share": 0.02312
        },
        {
          "period": "1995-07-01",
          "share": 0.02421
        },
        {
          "period": "1996-07-01",
          "share": 0.02921
        },
        {
          "period": "1997-07-01",
          "share": 0.03706
        },
        {
          "period": "1998-07-01",
          "share": 0.03881
        },
        {
          "period": "1999-07-01",
          "share": 0.04069
        },
        {
          "period": "2000-07-01",
          "share": 0.04211
        },
        {
          "period": "2001-07-01",
          "share": 0.02928
        },
        {
          "period": "2002-07-01",
          "share": 0.02101
        },
        {
          "period": "2003-07-01",
          "share": 0.02038
        },
        {
          "period": "2004-07-01",
          "share": 0.01742
        },
        {
          "period": "2005-07-01",
          "share": 0.01857
        },
        {
          "period": "2006-07-01",
          "share": 0.01991
        },
        {
          "period": "2007-07-01",
          "share": 0.02307
        },
        {
          "period": "2008-07-01",
          "share": 0.01566
        },
        {
          "period": "2009-07-01",
          "share": 0.01536
        },
        {
          "period": "2010-07-01",
          "share": 0.01704
        },
        {
          "period": "2011-07-01",
          "share": 0.01617
        },
        {
          "period": "2012-07-01",
          "share": 0.02068
        },
        {
          "period": "2013-07-01",
          "share": 0.02481
        },
        {
          "period": "2014-07-01",
          "share": 0.02756
        },
        {
          "period": "2015-07-01",
          "share": 0.02409
        },
        {
          "period": "2016-07-01",
          "share": 0.02556
        },
        {
          "period": "2017-07-01",
          "share": 0.02622
        },
        {
          "period": "2018-07-01",
          "share": 0.02613
        },
        {
          "period": "2019-07-01",
          "share": 0.02236
        },
        {
          "period": "2020-07-01",
          "share": 0.0301
        },
        {
          "period": "2021-07-01",
          "share": 0.04518
        },
        {
          "period": "2022-07-01",
          "share": 0.03453
        },
        {
          "period": "2023-07-01",
          "share": 0.03949
        },
        {
          "period": "2024-07-01",
          "share": 0.05103
        },
        {
          "period": "2025-07-01",
          "share": 0.05736
        }
      ]
    },
    "private_business": {
      "top01": [
        {
          "period": "1989-07-01",
          "share": 0.32802
        },
        {
          "period": "1990-07-01",
          "share": 0.33946
        },
        {
          "period": "1991-07-01",
          "share": 0.30421
        },
        {
          "period": "1992-07-01",
          "share": 0.28622
        },
        {
          "period": "1993-07-01",
          "share": 0.25605
        },
        {
          "period": "1994-07-01",
          "share": 0.25754
        },
        {
          "period": "1995-07-01",
          "share": 0.24576
        },
        {
          "period": "1996-07-01",
          "share": 0.2341
        },
        {
          "period": "1997-07-01",
          "share": 0.2282
        },
        {
          "period": "1998-07-01",
          "share": 0.23419
        },
        {
          "period": "1999-07-01",
          "share": 0.23002
        },
        {
          "period": "2000-07-01",
          "share": 0.23326
        },
        {
          "period": "2001-07-01",
          "share": 0.27986
        },
        {
          "period": "2002-07-01",
          "share": 0.28554
        },
        {
          "period": "2003-07-01",
          "share": 0.25417
        },
        {
          "period": "2004-07-01",
          "share": 0.25446
        },
        {
          "period": "2005-07-01",
          "share": 0.26838
        },
        {
          "period": "2006-07-01",
          "share": 0.26924
        },
        {
          "period": "2007-07-01",
          "share": 0.25026
        },
        {
          "period": "2008-07-01",
          "share": 0.23411
        },
        {
          "period": "2009-07-01",
          "share": 0.17246
        },
        {
          "period": "2010-07-01",
          "share": 0.17603
        },
        {
          "period": "2011-07-01",
          "share": 0.19449
        },
        {
          "period": "2012-07-01",
          "share": 0.20479
        },
        {
          "period": "2013-07-01",
          "share": 0.22783
        },
        {
          "period": "2014-07-01",
          "share": 0.22445
        },
        {
          "period": "2015-07-01",
          "share": 0.24241
        },
        {
          "period": "2016-07-01",
          "share": 0.23634
        },
        {
          "period": "2017-07-01",
          "share": 0.24253
        },
        {
          "period": "2018-07-01",
          "share": 0.24701
        },
        {
          "period": "2019-07-01",
          "share": 0.26273
        },
        {
          "period": "2020-07-01",
          "share": 0.24739
        },
        {
          "period": "2021-07-01",
          "share": 0.22456
        },
        {
          "period": "2022-07-01",
          "share": 0.26424
        },
        {
          "period": "2023-07-01",
          "share": 0.23515
        },
        {
          "period": "2024-07-01",
          "share": 0.1934
        }
      ],
      "top1": [
        {
          "period": "1989-07-01",
          "share": 0.27304
        },
        {
          "period": "1990-07-01",
          "share": 0.28052
        },
        {
          "period": "1991-07-01",
          "share": 0.25674
        },
        {
          "period": "1992-07-01",
          "share": 0.24385
        },
        {
          "period": "1993-07-01",
          "share": 0.23478
        },
        {
          "period": "1994-07-01",
          "share": 0.24375
        },
        {
          "period": "1995-07-01",
          "share": 0.2393
        },
        {
          "period": "1996-07-01",
          "share": 0.22392
        },
        {
          "period": "1997-07-01",
          "share": 0.21007
        },
        {
          "period": "1998-07-01",
          "share": 0.20742
        },
        {
          "period": "1999-07-01",
          "share": 0.20174
        },
        {
          "period": "2000-07-01",
          "share": 0.20076
        },
        {
          "period": "2001-07-01",
          "share": 0.23249
        },
        {
          "period": "2002-07-01",
          "share": 0.24159
        },
        {
          "period": "2003-07-01",
          "share": 0.22648
        },
        {
          "period": "2004-07-01",
          "share": 0.22654
        },
        {
          "period": "2005-07-01",
          "share": 0.22512
        },
        {
          "period": "2006-07-01",
          "share": 0.22
        },
        {
          "period": "2007-07-01",
          "share": 0.20475
        },
        {
          "period": "2008-07-01",
          "share": 0.19986
        },
        {
          "period": "2009-07-01",
          "share": 0.16138
        },
        {
          "period": "2010-07-01",
          "share": 0.1651
        },
        {
          "period": "2011-07-01",
          "share": 0.16904
        },
        {
          "period": "2012-07-01",
          "share": 0.16721
        },
        {
          "period": "2013-07-01",
          "share": 0.17414
        },
        {
          "period": "2014-07-01",
          "share": 0.17914
        },
        {
          "period": "2015-07-01",
          "share": 0.19676
        },
        {
          "period": "2016-07-01",
          "share": 0.19692
        },
        {
          "period": "2017-07-01",
          "share": 0.19279
        },
        {
          "period": "2018-07-01",
          "share": 0.18782
        },
        {
          "period": "2019-07-01",
          "share": 0.19061
        },
        {
          "period": "2020-07-01",
          "share": 0.18949
        },
        {
          "period": "2021-07-01",
          "share": 0.18048
        },
        {
          "period": "2022-07-01",
          "share": 0.21575
        },
        {
          "period": "2023-07-01",
          "share": 0.19384
        },
        {
          "period": "2024-07-01",
          "share": 0.1622
        }
      ],
      "next9": [
        {
          "period": "1989-07-01",
          "share": 0.12373
        },
        {
          "period": "1990-07-01",
          "share": 0.12661
        },
        {
          "period": "1991-07-01",
          "share": 0.12141
        },
        {
          "period": "1992-07-01",
          "share": 0.11491
        },
        {
          "period": "1993-07-01",
          "share": 0.10711
        },
        {
          "period": "1994-07-01",
          "share": 0.10514
        },
        {
          "period": "1995-07-01",
          "share": 0.10062
        },
        {
          "period": "1996-07-01",
          "share": 0.10185
        },
        {
          "period": "1997-07-01",
          "share": 0.10355
        },
        {
          "period": "1998-07-01",
          "share": 0.10788
        },
        {
          "period": "1999-07-01",
          "share": 0.10078
        },
        {
          "period": "2000-07-01",
          "share": 0.09664
        },
        {
          "period": "2001-07-01",
          "share": 0.1023
        },
        {
          "period": "2002-07-01",
          "share": 0.09954
        },
        {
          "period": "2003-07-01",
          "share": 0.09034
        },
        {
          "period": "2004-07-01",
          "share": 0.09218
        },
        {
          "period": "2005-07-01",
          "share": 0.10261
        },
        {
          "period": "2006-07-01",
          "share": 0.11004
        },
        {
          "period": "2007-07-01",
          "share": 0.11193
        },
        {
          "period": "2008-07-01",
          "share": 0.1018
        },
        {
          "period": "2009-07-01",
          "share": 0.08106
        },
        {
          "period": "2010-07-01",
          "share": 0.07914
        },
        {
          "period": "2011-07-01",
          "share": 0.08424
        },
        {
          "period": "2012-07-01",
          "share": 0.08859
        },
        {
          "period": "2013-07-01",
          "share": 0.09449
        },
        {
          "period": "2014-07-01",
          "share": 0.08792
        },
        {
          "period": "2015-07-01",
          "share": 0.08804
        },
        {
          "period": "2016-07-01",
          "share": 0.08233
        },
        {
          "period": "2017-07-01",
          "share": 0.08383
        },
        {
          "period": "2018-07-01",
          "share": 0.08499
        },
        {
          "period": "2019-07-01",
          "share": 0.08877
        },
        {
          "period": "2020-07-01",
          "share": 0.08775
        },
        {
          "period": "2021-07-01",
          "share": 0.08709
        },
        {
          "period": "2022-07-01",
          "share": 0.09998
        },
        {
          "period": "2023-07-01",
          "share": 0.09097
        },
        {
          "period": "2024-07-01",
          "share": 0.0786
        }
      ],
      "next40": [
        {
          "period": "1989-07-01",
          "share": 0.06787
        },
        {
          "period": "1990-07-01",
          "share": 0.06474
        },
        {
          "period": "1991-07-01",
          "share": 0.06039
        },
        {
          "period": "1992-07-01",
          "share": 0.05586
        },
        {
          "period": "1993-07-01",
          "share": 0.05384
        },
        {
          "period": "1994-07-01",
          "share": 0.0526
        },
        {
          "period": "1995-07-01",
          "share": 0.05076
        },
        {
          "period": "1996-07-01",
          "share": 0.05143
        },
        {
          "period": "1997-07-01",
          "share": 0.05252
        },
        {
          "period": "1998-07-01",
          "share": 0.05395
        },
        {
          "period": "1999-07-01",
          "share": 0.05311
        },
        {
          "period": "2000-07-01",
          "share": 0.05188
        },
        {
          "period": "2001-07-01",
          "share": 0.05239
        },
        {
          "period": "2002-07-01",
          "share": 0.05488
        },
        {
          "period": "2003-07-01",
          "share": 0.05555
        },
        {
          "period": "2004-07-01",
          "share": 0.05803
        },
        {
          "period": "2005-07-01",
          "share": 0.05381
        },
        {
          "period": "2006-07-01",
          "share": 0.05074
        },
        {
          "period": "2007-07-01",
          "share": 0.0477
        },
        {
          "period": "2008-07-01",
          "share": 0.04896
        },
        {
          "period": "2009-07-01",
          "share": 0.04634
        },
        {
          "period": "2010-07-01",
          "share": 0.05017
        },
        {
          "period": "2011-07-01",
          "share": 0.04856
        },
        {
          "period": "2012-07-01",
          "share": 0.04668
        },
        {
          "period": "2013-07-01",
          "share": 0.04463
        },
        {
          "period": "2014-07-01",
          "share": 0.04433
        },
        {
          "period": "2015-07-01",
          "share": 0.04585
        },
        {
          "period": "2016-07-01",
          "share": 0.04471
        },
        {
          "period": "2017-07-01",
          "share": 0.04353
        },
        {
          "period": "2018-07-01",
          "share": 0.04241
        },
        {
          "period": "2019-07-01",
          "share": 0.04252
        },
        {
          "period": "2020-07-01",
          "share": 0.0428
        },
        {
          "period": "2021-07-01",
          "share": 0.04301
        },
        {
          "period": "2022-07-01",
          "share": 0.04697
        },
        {
          "period": "2023-07-01",
          "share": 0.04376
        },
        {
          "period": "2024-07-01",
          "share": 0.0397
        }
      ],
      "bottom50": [
        {
          "period": "1989-07-01",
          "share": 0.02369
        },
        {
          "period": "1990-07-01",
          "share": 0.02308
        },
        {
          "period": "1991-07-01",
          "share": 0.02232
        },
        {
          "period": "1992-07-01",
          "share": 0.02167
        },
        {
          "period": "1993-07-01",
          "share": 0.02198
        },
        {
          "period": "1994-07-01",
          "share": 0.02213
        },
        {
          "period": "1995-07-01",
          "share": 0.02101
        },
        {
          "period": "1996-07-01",
          "share": 0.02468
        },
        {
          "period": "1997-07-01",
          "share": 0.02719
        },
        {
          "period": "1998-07-01",
          "share": 0.02928
        },
        {
          "period": "1999-07-01",
          "share": 0.02452
        },
        {
          "period": "2000-07-01",
          "share": 0.02022
        },
        {
          "period": "2001-07-01",
          "share": 0.01757
        },
        {
          "period": "2002-07-01",
          "share": 0.01906
        },
        {
          "period": "2003-07-01",
          "share": 0.01986
        },
        {
          "period": "2004-07-01",
          "share": 0.01972
        },
        {
          "period": "2005-07-01",
          "share": 0.02273
        },
        {
          "period": "2006-07-01",
          "share": 0.02545
        },
        {
          "period": "2007-07-01",
          "share": 0.02899
        },
        {
          "period": "2008-07-01",
          "share": 0.03117
        },
        {
          "period": "2009-07-01",
          "share": 0.032
        },
        {
          "period": "2010-07-01",
          "share": 0.03258
        },
        {
          "period": "2011-07-01",
          "share": 0.0305
        },
        {
          "period": "2012-07-01",
          "share": 0.02675
        },
        {
          "period": "2013-07-01",
          "share": 0.02125
        },
        {
          "period": "2014-07-01",
          "share": 0.02201
        },
        {
          "period": "2015-07-01",
          "share": 0.02302
        },
        {
          "period": "2016-07-01",
          "share": 0.02323
        },
        {
          "period": "2017-07-01",
          "share": 0.02522
        },
        {
          "period": "2018-07-01",
          "share": 0.02682
        },
        {
          "period": "2019-07-01",
          "share": 0.02855
        },
        {
          "period": "2020-07-01",
          "share": 0.0248
        },
        {
          "period": "2021-07-01",
          "share": 0.02006
        },
        {
          "period": "2022-07-01",
          "share": 0.01758
        },
        {
          "period": "2023-07-01",
          "share": 0.01743
        },
        {
          "period": "2024-07-01",
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
          "share": 0.10277
        },
        {
          "period": "1991-07-01",
          "share": 0.11489
        },
        {
          "period": "1992-07-01",
          "share": 0.13307
        },
        {
          "period": "1993-07-01",
          "share": 0.10756
        },
        {
          "period": "1994-07-01",
          "share": 0.08923
        },
        {
          "period": "1995-07-01",
          "share": 0.06945
        },
        {
          "period": "1996-07-01",
          "share": 0.06914
        },
        {
          "period": "1997-07-01",
          "share": 0.06597
        },
        {
          "period": "1998-07-01",
          "share": 0.0703
        },
        {
          "period": "1999-07-01",
          "share": 0.07708
        },
        {
          "period": "2000-07-01",
          "share": 0.08425
        },
        {
          "period": "2001-07-01",
          "share": 0.1101
        },
        {
          "period": "2002-07-01",
          "share": 0.12744
        },
        {
          "period": "2003-07-01",
          "share": 0.1253
        },
        {
          "period": "2004-07-01",
          "share": 0.11746
        },
        {
          "period": "2005-07-01",
          "share": 0.11208
        },
        {
          "period": "2006-07-01",
          "share": 0.0993
        },
        {
          "period": "2007-07-01",
          "share": 0.08047
        },
        {
          "period": "2008-07-01",
          "share": 0.09406
        },
        {
          "period": "2009-07-01",
          "share": 0.10191
        },
        {
          "period": "2010-07-01",
          "share": 0.10105
        },
        {
          "period": "2011-07-01",
          "share": 0.09282
        },
        {
          "period": "2012-07-01",
          "share": 0.08245
        },
        {
          "period": "2013-07-01",
          "share": 0.0812
        },
        {
          "period": "2014-07-01",
          "share": 0.07862
        },
        {
          "period": "2015-07-01",
          "share": 0.08149
        },
        {
          "period": "2016-07-01",
          "share": 0.08025
        },
        {
          "period": "2017-07-01",
          "share": 0.08178
        },
        {
          "period": "2018-07-01",
          "share": 0.08197
        },
        {
          "period": "2019-07-01",
          "share": 0.08044
        },
        {
          "period": "2020-07-01",
          "share": 0.08138
        },
        {
          "period": "2021-07-01",
          "share": 0.07936
        },
        {
          "period": "2022-07-01",
          "share": 0.09733
        },
        {
          "period": "2023-07-01",
          "share": 0.09324
        },
        {
          "period": "2024-07-01",
          "share": 0.0832
        },
        {
          "period": "2025-07-01",
          "share": 0.07695
        }
      ],
      "top1": [
        {
          "period": "1989-07-01",
          "share": 0.12906
        },
        {
          "period": "1990-07-01",
          "share": 0.14662
        },
        {
          "period": "1991-07-01",
          "share": 0.14701
        },
        {
          "period": "1992-07-01",
          "share": 0.15646
        },
        {
          "period": "1993-07-01",
          "share": 0.1384
        },
        {
          "period": "1994-07-01",
          "share": 0.12634
        },
        {
          "period": "1995-07-01",
          "share": 0.10404
        },
        {
          "period": "1996-07-01",
          "share": 0.10645
        },
        {
          "period": "1997-07-01",
          "share": 0.10387
        },
        {
          "period": "1998-07-01",
          "share": 0.10945
        },
        {
          "period": "1999-07-01",
          "share": 0.11513
        },
        {
          "period": "2000-07-01",
          "share": 0.12278
        },
        {
          "period": "2001-07-01",
          "share": 0.15722
        },
        {
          "period": "2002-07-01",
          "share": 0.1837
        },
        {
          "period": "2003-07-01",
          "share": 0.1872
        },
        {
          "period": "2004-07-01",
          "share": 0.18533
        },
        {
          "period": "2005-07-01",
          "share": 0.18383
        },
        {
          "period": "2006-07-01",
          "share": 0.17133
        },
        {
          "period": "2007-07-01",
          "share": 0.14968
        },
        {
          "period": "2008-07-01",
          "share": 0.15514
        },
        {
          "period": "2009-07-01",
          "share": 0.14866
        },
        {
          "period": "2010-07-01",
          "share": 0.13919
        },
        {
          "period": "2011-07-01",
          "share": 0.13399
        },
        {
          "period": "2012-07-01",
          "share": 0.12545
        },
        {
          "period": "2013-07-01",
          "share": 0.12734
        },
        {
          "period": "2014-07-01",
          "share": 0.12521
        },
        {
          "period": "2015-07-01",
          "share": 0.13078
        },
        {
          "period": "2016-07-01",
          "share": 0.13068
        },
        {
          "period": "2017-07-01",
          "share": 0.13093
        },
        {
          "period": "2018-07-01",
          "share": 0.13007
        },
        {
          "period": "2019-07-01",
          "share": 0.12699
        },
        {
          "period": "2020-07-01",
          "share": 0.12532
        },
        {
          "period": "2021-07-01",
          "share": 0.1212
        },
        {
          "period": "2022-07-01",
          "share": 0.14173
        },
        {
          "period": "2023-07-01",
          "share": 0.13698
        },
        {
          "period": "2024-07-01",
          "share": 0.12425
        },
        {
          "period": "2025-07-01",
          "share": 0.11592
        }
      ],
      "next9": [
        {
          "period": "1989-07-01",
          "share": 0.2454
        },
        {
          "period": "1990-07-01",
          "share": 0.24633
        },
        {
          "period": "1991-07-01",
          "share": 0.23256
        },
        {
          "period": "1992-07-01",
          "share": 0.22518
        },
        {
          "period": "1993-07-01",
          "share": 0.22229
        },
        {
          "period": "1994-07-01",
          "share": 0.22435
        },
        {
          "period": "1995-07-01",
          "share": 0.20814
        },
        {
          "period": "1996-07-01",
          "share": 0.2034
        },
        {
          "period": "1997-07-01",
          "share": 0.19369
        },
        {
          "period": "1998-07-01",
          "share": 0.19592
        },
        {
          "period": "1999-07-01",
          "share": 0.20042
        },
        {
          "period": "2000-07-01",
          "share": 0.20565
        },
        {
          "period": "2001-07-01",
          "share": 0.23861
        },
        {
          "period": "2002-07-01",
          "share": 0.25814
        },
        {
          "period": "2003-07-01",
          "share": 0.25446
        },
        {
          "period": "2004-07-01",
          "share": 0.2573
        },
        {
          "period": "2005-07-01",
          "share": 0.26724
        },
        {
          "period": "2006-07-01",
          "share": 0.26346
        },
        {
          "period": "2007-07-01",
          "share": 0.24507
        },
        {
          "period": "2008-07-01",
          "share": 0.23925
        },
        {
          "period": "2009-07-01",
          "share": 0.22868
        },
        {
          "period": "2010-07-01",
          "share": 0.21477
        },
        {
          "period": "2011-07-01",
          "share": 0.20415
        },
        {
          "period": "2012-07-01",
          "share": 0.19391
        },
        {
          "period": "2013-07-01",
          "share": 0.19238
        },
        {
          "period": "2014-07-01",
          "share": 0.19202
        },
        {
          "period": "2015-07-01",
          "share": 0.19912
        },
        {
          "period": "2016-07-01",
          "share": 0.19941
        },
        {
          "period": "2017-07-01",
          "share": 0.19936
        },
        {
          "period": "2018-07-01",
          "share": 0.19841
        },
        {
          "period": "2019-07-01",
          "share": 0.19316
        },
        {
          "period": "2020-07-01",
          "share": 0.19897
        },
        {
          "period": "2021-07-01",
          "share": 0.21192
        },
        {
          "period": "2022-07-01",
          "share": 0.24957
        },
        {
          "period": "2023-07-01",
          "share": 0.24413
        },
        {
          "period": "2024-07-01",
          "share": 0.22921
        },
        {
          "period": "2025-07-01",
          "share": 0.21933
        }
      ],
      "next40": [
        {
          "period": "1989-07-01",
          "share": 0.38706
        },
        {
          "period": "1990-07-01",
          "share": 0.37479
        },
        {
          "period": "1991-07-01",
          "share": 0.35384
        },
        {
          "period": "1992-07-01",
          "share": 0.3447
        },
        {
          "period": "1993-07-01",
          "share": 0.34716
        },
        {
          "period": "1994-07-01",
          "share": 0.35649
        },
        {
          "period": "1995-07-01",
          "share": 0.34607
        },
        {
          "period": "1996-07-01",
          "share": 0.33911
        },
        {
          "period": "1997-07-01",
          "share": 0.32404
        },
        {
          "period": "1998-07-01",
          "share": 0.32635
        },
        {
          "period": "1999-07-01",
          "share": 0.32334
        },
        {
          "period": "2000-07-01",
          "share": 0.33304
        },
        {
          "period": "2001-07-01",
          "share": 0.3669
        },
        {
          "period": "2002-07-01",
          "share": 0.38603
        },
        {
          "period": "2003-07-01",
          "share": 0.39229
        },
        {
          "period": "2004-07-01",
          "share": 0.40504
        },
        {
          "period": "2005-07-01",
          "share": 0.41728
        },
        {
          "period": "2006-07-01",
          "share": 0.4154
        },
        {
          "period": "2007-07-01",
          "share": 0.39184
        },
        {
          "period": "2008-07-01",
          "share": 0.37158
        },
        {
          "period": "2009-07-01",
          "share": 0.34909
        },
        {
          "period": "2010-07-01",
          "share": 0.33031
        },
        {
          "period": "2011-07-01",
          "share": 0.31256
        },
        {
          "period": "2012-07-01",
          "share": 0.29879
        },
        {
          "period": "2013-07-01",
          "share": 0.3024
        },
        {
          "period": "2014-07-01",
          "share": 0.31031
        },
        {
          "period": "2015-07-01",
          "share": 0.32494
        },
        {
          "period": "2016-07-01",
          "share": 0.33485
        },
        {
          "period": "2017-07-01",
          "share": 0.3415
        },
        {
          "period": "2018-07-01",
          "share": 0.34655
        },
        {
          "period": "2019-07-01",
          "share": 0.33948
        },
        {
          "period": "2020-07-01",
          "share": 0.33736
        },
        {
          "period": "2021-07-01",
          "share": 0.35505
        },
        {
          "period": "2022-07-01",
          "share": 0.38281
        },
        {
          "period": "2023-07-01",
          "share": 0.39069
        },
        {
          "period": "2024-07-01",
          "share": 0.38427
        },
        {
          "period": "2025-07-01",
          "share": 0.37523
        }
      ],
      "bottom50": [
        {
          "period": "1989-07-01",
          "share": 0.48431
        },
        {
          "period": "1990-07-01",
          "share": 0.48085
        },
        {
          "period": "1991-07-01",
          "share": 0.48461
        },
        {
          "period": "1992-07-01",
          "share": 0.49417
        },
        {
          "period": "1993-07-01",
          "share": 0.48612
        },
        {
          "period": "1994-07-01",
          "share": 0.48173
        },
        {
          "period": "1995-07-01",
          "share": 0.50388
        },
        {
          "period": "1996-07-01",
          "share": 0.48795
        },
        {
          "period": "1997-07-01",
          "share": 0.47604
        },
        {
          "period": "1998-07-01",
          "share": 0.48474
        },
        {
          "period": "1999-07-01",
          "share": 0.49145
        },
        {
          "period": "2000-07-01",
          "share": 0.49836
        },
        {
          "period": "2001-07-01",
          "share": 0.51339
        },
        {
          "period": "2002-07-01",
          "share": 0.52952
        },
        {
          "period": "2003-07-01",
          "share": 0.54399
        },
        {
          "period": "2004-07-01",
          "share": 0.56654
        },
        {
          "period": "2005-07-01",
          "share": 0.58268
        },
        {
          "period": "2006-07-01",
          "share": 0.59144
        },
        {
          "period": "2007-07-01",
          "share": 0.57206
        },
        {
          "period": "2008-07-01",
          "share": 0.55603
        },
        {
          "period": "2009-07-01",
          "share": 0.54447
        },
        {
          "period": "2010-07-01",
          "share": 0.54131
        },
        {
          "period": "2011-07-01",
          "share": 0.51071
        },
        {
          "period": "2012-07-01",
          "share": 0.49159
        },
        {
          "period": "2013-07-01",
          "share": 0.49244
        },
        {
          "period": "2014-07-01",
          "share": 0.48713
        },
        {
          "period": "2015-07-01",
          "share": 0.48849
        },
        {
          "period": "2016-07-01",
          "share": 0.48987
        },
        {
          "period": "2017-07-01",
          "share": 0.49089
        },
        {
          "period": "2018-07-01",
          "share": 0.49638
        },
        {
          "period": "2019-07-01",
          "share": 0.50241
        },
        {
          "period": "2020-07-01",
          "share": 0.49347
        },
        {
          "period": "2021-07-01",
          "share": 0.4911
        },
        {
          "period": "2022-07-01",
          "share": 0.51141
        },
        {
          "period": "2023-07-01",
          "share": 0.50293
        },
        {
          "period": "2024-07-01",
          "share": 0.48628
        },
        {
          "period": "2025-07-01",
          "share": 0.47222
        }
      ]
    }
  }
}
