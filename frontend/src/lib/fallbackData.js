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
    "retrieved_at": "2026-08-17T06:10:46+00:00",
    "units": "US dollars, not seasonally adjusted"
  },
  "latest_period": "2024-07-01",
  "periods": [
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
    "top1": {
      "key": "top1",
      "label": "Top 1%",
      "percentile_range": "99th-100th",
      "period": "2024-07-01",
      "total_assets": 50667755000000.0,
      "total_liabilities": 1058617000000.0,
      "net_worth": 49609139000000.0,
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
      }
    },
    "next9": {
      "key": "next9",
      "label": "Next 9%",
      "percentile_range": "90th-99th",
      "period": "2024-07-01",
      "total_assets": 62481853000000.0,
      "total_liabilities": 3894046000000.0,
      "net_worth": 58587807000000.0,
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
      }
    },
    "next40": {
      "key": "next40",
      "label": "Next 40%",
      "percentile_range": "50th-90th",
      "period": "2024-07-01",
      "total_assets": 57041170000000.0,
      "total_liabilities": 8570021000000.0,
      "net_worth": 48471149000000.0,
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
      }
    },
    "bottom50": {
      "key": "bottom50",
      "label": "Bottom 50%",
      "percentile_range": "0-50th",
      "period": "2024-07-01",
      "total_assets": 9828692000000.0,
      "total_liabilities": 5942374000000.0,
      "net_worth": 3886317000000.0,
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
      }
    }
  },
  "trends": {
    "corporate_equities": {
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
        }
      ]
    },
    "private_business": {
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
        }
      ]
    }
  }
}
