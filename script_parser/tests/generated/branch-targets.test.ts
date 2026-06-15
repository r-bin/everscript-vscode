import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../model/rom-script-model.ts';

const BRANCH_CASES = [
  {
    "opcode": 9,
    "instructionAddress": 9814549,
    "expectedBranchTarget": 9814592
  },
  {
    "opcode": 9,
    "instructionAddress": 9938935,
    "expectedBranchTarget": 9938950
  },
  {
    "opcode": 166,
    "instructionAddress": 9668287,
    "expectedBranchTarget": 9667419
  },
  {
    "opcode": 8,
    "instructionAddress": 9757170,
    "expectedBranchTarget": 9757184
  },
  {
    "opcode": 4,
    "instructionAddress": 9687669,
    "expectedBranchTarget": 9687846
  },
  {
    "opcode": 166,
    "instructionAddress": 10205585,
    "expectedBranchTarget": 10204400
  },
  {
    "opcode": 9,
    "instructionAddress": 9734547,
    "expectedBranchTarget": 9734557
  },
  {
    "opcode": 41,
    "instructionAddress": 9758679,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 41,
    "instructionAddress": 9667830,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 9757590,
    "expectedBranchTarget": 9757603
  },
  {
    "opcode": 9,
    "instructionAddress": 10079712,
    "expectedBranchTarget": 10079727
  },
  {
    "opcode": 41,
    "instructionAddress": 9668268,
    "expectedBranchTarget": 9619909
  },
  {
    "opcode": 166,
    "instructionAddress": 10022837,
    "expectedBranchTarget": 10021219
  },
  {
    "opcode": 41,
    "instructionAddress": 9948130,
    "expectedBranchTarget": 9610215
  },
  {
    "opcode": 9,
    "instructionAddress": 9757780,
    "expectedBranchTarget": 9757800
  },
  {
    "opcode": 166,
    "instructionAddress": 10063251,
    "expectedBranchTarget": 10062244
  },
  {
    "opcode": 4,
    "instructionAddress": 9740299,
    "expectedBranchTarget": 9740559
  },
  {
    "opcode": 4,
    "instructionAddress": 9804591,
    "expectedBranchTarget": 9804612
  },
  {
    "opcode": 9,
    "instructionAddress": 9745158,
    "expectedBranchTarget": 9745212
  },
  {
    "opcode": 9,
    "instructionAddress": 9757398,
    "expectedBranchTarget": 9757450
  },
  {
    "opcode": 4,
    "instructionAddress": 9757209,
    "expectedBranchTarget": 9757228
  },
  {
    "opcode": 41,
    "instructionAddress": 10140432,
    "expectedBranchTarget": 9619929
  },
  {
    "opcode": 166,
    "instructionAddress": 9687827,
    "expectedBranchTarget": 9685621
  },
  {
    "opcode": 8,
    "instructionAddress": 9738696,
    "expectedBranchTarget": 9738712
  },
  {
    "opcode": 41,
    "instructionAddress": 9758253,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 10011658,
    "expectedBranchTarget": 10011701
  },
  {
    "opcode": 9,
    "instructionAddress": 9757709,
    "expectedBranchTarget": 9757780
  },
  {
    "opcode": 9,
    "instructionAddress": 9877070,
    "expectedBranchTarget": 9877083
  },
  {
    "opcode": 4,
    "instructionAddress": 10021040,
    "expectedBranchTarget": 10021047
  },
  {
    "opcode": 9,
    "instructionAddress": 9678634,
    "expectedBranchTarget": 9678649
  },
  {
    "opcode": 9,
    "instructionAddress": 9877579,
    "expectedBranchTarget": 9877600
  },
  {
    "opcode": 41,
    "instructionAddress": 9883710,
    "expectedBranchTarget": 9610274
  },
  {
    "opcode": 9,
    "instructionAddress": 9667801,
    "expectedBranchTarget": 9667836
  },
  {
    "opcode": 9,
    "instructionAddress": 10076917,
    "expectedBranchTarget": 10076939
  },
  {
    "opcode": 9,
    "instructionAddress": 9877159,
    "expectedBranchTarget": 9877183
  },
  {
    "opcode": 9,
    "instructionAddress": 9997001,
    "expectedBranchTarget": 9997110
  },
  {
    "opcode": 41,
    "instructionAddress": 9883664,
    "expectedBranchTarget": 9610244
  },
  {
    "opcode": 4,
    "instructionAddress": 9757797,
    "expectedBranchTarget": 9757804
  },
  {
    "opcode": 4,
    "instructionAddress": 10192502,
    "expectedBranchTarget": 10192542
  },
  {
    "opcode": 4,
    "instructionAddress": 10145964,
    "expectedBranchTarget": 10145993
  },
  {
    "opcode": 9,
    "instructionAddress": 10069720,
    "expectedBranchTarget": 10069728
  },
  {
    "opcode": 4,
    "instructionAddress": 9822777,
    "expectedBranchTarget": 9822784
  },
  {
    "opcode": 166,
    "instructionAddress": 10083384,
    "expectedBranchTarget": 10083097
  },
  {
    "opcode": 9,
    "instructionAddress": 9997120,
    "expectedBranchTarget": 9997131
  },
  {
    "opcode": 9,
    "instructionAddress": 9687586,
    "expectedBranchTarget": 9687601
  },
  {
    "opcode": 4,
    "instructionAddress": 10195843,
    "expectedBranchTarget": 10195863
  },
  {
    "opcode": 4,
    "instructionAddress": 10205641,
    "expectedBranchTarget": 10205648
  },
  {
    "opcode": 41,
    "instructionAddress": 9743687,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 9997019,
    "expectedBranchTarget": 9997060
  },
  {
    "opcode": 9,
    "instructionAddress": 9932367,
    "expectedBranchTarget": 9932377
  },
  {
    "opcode": 9,
    "instructionAddress": 9684635,
    "expectedBranchTarget": 9684645
  },
  {
    "opcode": 9,
    "instructionAddress": 9745426,
    "expectedBranchTarget": 9745434
  },
  {
    "opcode": 9,
    "instructionAddress": 9757192,
    "expectedBranchTarget": 9757230
  },
  {
    "opcode": 9,
    "instructionAddress": 9679513,
    "expectedBranchTarget": 9679586
  },
  {
    "opcode": 9,
    "instructionAddress": 10013184,
    "expectedBranchTarget": 10013264
  },
  {
    "opcode": 4,
    "instructionAddress": 9740377,
    "expectedBranchTarget": 9740559
  },
  {
    "opcode": 8,
    "instructionAddress": 9812675,
    "expectedBranchTarget": 9812689
  },
  {
    "opcode": 166,
    "instructionAddress": 10214765,
    "expectedBranchTarget": 10211444
  },
  {
    "opcode": 8,
    "instructionAddress": 9747910,
    "expectedBranchTarget": 9748032
  },
  {
    "opcode": 41,
    "instructionAddress": 9672300,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 8,
    "instructionAddress": 9740237,
    "expectedBranchTarget": 9740255
  },
  {
    "opcode": 9,
    "instructionAddress": 10214782,
    "expectedBranchTarget": 10214832
  },
  {
    "opcode": 8,
    "instructionAddress": 9678007,
    "expectedBranchTarget": 9678021
  },
  {
    "opcode": 9,
    "instructionAddress": 9688014,
    "expectedBranchTarget": 9688150
  },
  {
    "opcode": 9,
    "instructionAddress": 10134227,
    "expectedBranchTarget": 10134387
  },
  {
    "opcode": 4,
    "instructionAddress": 10195823,
    "expectedBranchTarget": 10195863
  },
  {
    "opcode": 9,
    "instructionAddress": 9752425,
    "expectedBranchTarget": 9752460
  },
  {
    "opcode": 166,
    "instructionAddress": 9946803,
    "expectedBranchTarget": 9945924
  },
  {
    "opcode": 9,
    "instructionAddress": 9734426,
    "expectedBranchTarget": 9734442
  },
  {
    "opcode": 41,
    "instructionAddress": 9681338,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 4,
    "instructionAddress": 9745045,
    "expectedBranchTarget": 9745346
  },
  {
    "opcode": 9,
    "instructionAddress": 10076943,
    "expectedBranchTarget": 10076969
  },
  {
    "opcode": 8,
    "instructionAddress": 9626000,
    "expectedBranchTarget": 9626492
  },
  {
    "opcode": 4,
    "instructionAddress": 10134384,
    "expectedBranchTarget": 10134529
  },
  {
    "opcode": 4,
    "instructionAddress": 9683661,
    "expectedBranchTarget": 9683668
  },
  {
    "opcode": 9,
    "instructionAddress": 9733259,
    "expectedBranchTarget": 9733269
  },
  {
    "opcode": 9,
    "instructionAddress": 9752059,
    "expectedBranchTarget": 9752084
  },
  {
    "opcode": 166,
    "instructionAddress": 9804588,
    "expectedBranchTarget": 9803907
  },
  {
    "opcode": 9,
    "instructionAddress": 9798936,
    "expectedBranchTarget": 9798947
  },
  {
    "opcode": 8,
    "instructionAddress": 9822784,
    "expectedBranchTarget": 9822793
  },
  {
    "opcode": 4,
    "instructionAddress": 9952854,
    "expectedBranchTarget": 9952861
  },
  {
    "opcode": 4,
    "instructionAddress": 9944759,
    "expectedBranchTarget": 9944766
  },
  {
    "opcode": 4,
    "instructionAddress": 9999715,
    "expectedBranchTarget": 9999763
  },
  {
    "opcode": 9,
    "instructionAddress": 9816923,
    "expectedBranchTarget": 9816939
  },
  {
    "opcode": 4,
    "instructionAddress": 9745176,
    "expectedBranchTarget": 9745182
  },
  {
    "opcode": 8,
    "instructionAddress": 9996590,
    "expectedBranchTarget": 9996610
  },
  {
    "opcode": 9,
    "instructionAddress": 9740259,
    "expectedBranchTarget": 9740276
  },
  {
    "opcode": 4,
    "instructionAddress": 10205517,
    "expectedBranchTarget": 10205522
  },
  {
    "opcode": 9,
    "instructionAddress": 9687605,
    "expectedBranchTarget": 9687611
  },
  {
    "opcode": 4,
    "instructionAddress": 9996574,
    "expectedBranchTarget": 9996610
  },
  {
    "opcode": 41,
    "instructionAddress": 10125909,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 8,
    "instructionAddress": 9679276,
    "expectedBranchTarget": 9679290
  },
  {
    "opcode": 165,
    "instructionAddress": 10063015,
    "expectedBranchTarget": 10062901
  },
  {
    "opcode": 9,
    "instructionAddress": 9733273,
    "expectedBranchTarget": 9733375
  },
  {
    "opcode": 9,
    "instructionAddress": 9687611,
    "expectedBranchTarget": 9687642
  },
  {
    "opcode": 41,
    "instructionAddress": 9759631,
    "expectedBranchTarget": 9610215
  },
  {
    "opcode": 9,
    "instructionAddress": 10009415,
    "expectedBranchTarget": 10009430
  },
  {
    "opcode": 41,
    "instructionAddress": 10190895,
    "expectedBranchTarget": 10191182
  },
  {
    "opcode": 4,
    "instructionAddress": 10013468,
    "expectedBranchTarget": 10013538
  },
  {
    "opcode": 9,
    "instructionAddress": 9822367,
    "expectedBranchTarget": 9822382
  },
  {
    "opcode": 9,
    "instructionAddress": 9757884,
    "expectedBranchTarget": 9757896
  },
  {
    "opcode": 9,
    "instructionAddress": 9951692,
    "expectedBranchTarget": 9951702
  },
  {
    "opcode": 9,
    "instructionAddress": 10077095,
    "expectedBranchTarget": 10077109
  },
  {
    "opcode": 9,
    "instructionAddress": 10126389,
    "expectedBranchTarget": 10126399
  },
  {
    "opcode": 41,
    "instructionAddress": 9667840,
    "expectedBranchTarget": 9610221
  },
  {
    "opcode": 4,
    "instructionAddress": 10079780,
    "expectedBranchTarget": 10079787
  },
  {
    "opcode": 166,
    "instructionAddress": 9757857,
    "expectedBranchTarget": 9754697
  },
  {
    "opcode": 9,
    "instructionAddress": 10088097,
    "expectedBranchTarget": 10088145
  },
  {
    "opcode": 9,
    "instructionAddress": 9740302,
    "expectedBranchTarget": 9740328
  },
  {
    "opcode": 8,
    "instructionAddress": 9736214,
    "expectedBranchTarget": 9736228
  },
  {
    "opcode": 166,
    "instructionAddress": 9822761,
    "expectedBranchTarget": 9822292
  },
  {
    "opcode": 8,
    "instructionAddress": 9738777,
    "expectedBranchTarget": 9738813
  },
  {
    "opcode": 41,
    "instructionAddress": 9694495,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 9945566,
    "expectedBranchTarget": 9945621
  },
  {
    "opcode": 9,
    "instructionAddress": 10214608,
    "expectedBranchTarget": 10214620
  },
  {
    "opcode": 9,
    "instructionAddress": 9946644,
    "expectedBranchTarget": 9946755
  },
  {
    "opcode": 41,
    "instructionAddress": 9952706,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 9759617,
    "expectedBranchTarget": 9759627
  },
  {
    "opcode": 9,
    "instructionAddress": 9757450,
    "expectedBranchTarget": 9757502
  },
  {
    "opcode": 166,
    "instructionAddress": 9748087,
    "expectedBranchTarget": 9747488
  },
  {
    "opcode": 9,
    "instructionAddress": 10013307,
    "expectedBranchTarget": 10013395
  },
  {
    "opcode": 9,
    "instructionAddress": 9883635,
    "expectedBranchTarget": 9883654
  },
  {
    "opcode": 166,
    "instructionAddress": 10003357,
    "expectedBranchTarget": 10002701
  },
  {
    "opcode": 9,
    "instructionAddress": 9948142,
    "expectedBranchTarget": 9948167
  },
  {
    "opcode": 9,
    "instructionAddress": 9757804,
    "expectedBranchTarget": 9757860
  },
  {
    "opcode": 4,
    "instructionAddress": 9952619,
    "expectedBranchTarget": 9952626
  },
  {
    "opcode": 41,
    "instructionAddress": 9739156,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 10070014,
    "expectedBranchTarget": 10070029
  },
  {
    "opcode": 4,
    "instructionAddress": 10011716,
    "expectedBranchTarget": 10011723
  },
  {
    "opcode": 9,
    "instructionAddress": 9948427,
    "expectedBranchTarget": 9948517
  },
  {
    "opcode": 41,
    "instructionAddress": 9885303,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 9745116,
    "expectedBranchTarget": 9745158
  },
  {
    "opcode": 4,
    "instructionAddress": 10087978,
    "expectedBranchTarget": 10087985
  },
  {
    "opcode": 9,
    "instructionAddress": 9745048,
    "expectedBranchTarget": 9745078
  },
  {
    "opcode": 8,
    "instructionAddress": 9688207,
    "expectedBranchTarget": 9688226
  },
  {
    "opcode": 9,
    "instructionAddress": 9946541,
    "expectedBranchTarget": 9946566
  },
  {
    "opcode": 8,
    "instructionAddress": 9819216,
    "expectedBranchTarget": 9819254
  },
  {
    "opcode": 4,
    "instructionAddress": 9948164,
    "expectedBranchTarget": 9948234
  },
  {
    "opcode": 9,
    "instructionAddress": 10013089,
    "expectedBranchTarget": 10013115
  },
  {
    "opcode": 4,
    "instructionAddress": 9948309,
    "expectedBranchTarget": 9948342
  },
  {
    "opcode": 4,
    "instructionAddress": 9688223,
    "expectedBranchTarget": 9688233
  },
  {
    "opcode": 9,
    "instructionAddress": 9626696,
    "expectedBranchTarget": 9626707
  },
  {
    "opcode": 4,
    "instructionAddress": 9948456,
    "expectedBranchTarget": 9948516
  },
  {
    "opcode": 9,
    "instructionAddress": 9946638,
    "expectedBranchTarget": 9946755
  },
  {
    "opcode": 4,
    "instructionAddress": 9740455,
    "expectedBranchTarget": 9740559
  },
  {
    "opcode": 4,
    "instructionAddress": 10011683,
    "expectedBranchTarget": 10011699
  },
  {
    "opcode": 9,
    "instructionAddress": 9745006,
    "expectedBranchTarget": 9745048
  },
  {
    "opcode": 9,
    "instructionAddress": 9822731,
    "expectedBranchTarget": 9822747
  },
  {
    "opcode": 166,
    "instructionAddress": 9883758,
    "expectedBranchTarget": 9882654
  },
  {
    "opcode": 41,
    "instructionAddress": 9818113,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 8,
    "instructionAddress": 9667821,
    "expectedBranchTarget": 9667830
  },
  {
    "opcode": 4,
    "instructionAddress": 9742539,
    "expectedBranchTarget": 9742681
  },
  {
    "opcode": 9,
    "instructionAddress": 10128452,
    "expectedBranchTarget": 10128486
  },
  {
    "opcode": 8,
    "instructionAddress": 9745307,
    "expectedBranchTarget": 9745319
  },
  {
    "opcode": 4,
    "instructionAddress": 10140845,
    "expectedBranchTarget": 10140859
  },
  {
    "opcode": 4,
    "instructionAddress": 10088135,
    "expectedBranchTarget": 10088142
  },
  {
    "opcode": 4,
    "instructionAddress": 10082490,
    "expectedBranchTarget": 10082497
  },
  {
    "opcode": 8,
    "instructionAddress": 9822386,
    "expectedBranchTarget": 9822400
  },
  {
    "opcode": 4,
    "instructionAddress": 9687639,
    "expectedBranchTarget": 9687846
  },
  {
    "opcode": 166,
    "instructionAddress": 10214779,
    "expectedBranchTarget": 10211444
  },
  {
    "opcode": 9,
    "instructionAddress": 9809934,
    "expectedBranchTarget": 9809945
  },
  {
    "opcode": 4,
    "instructionAddress": 10012036,
    "expectedBranchTarget": 10012043
  },
  {
    "opcode": 8,
    "instructionAddress": 9738750,
    "expectedBranchTarget": 9738766
  },
  {
    "opcode": 41,
    "instructionAddress": 9996953,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 10129749,
    "expectedBranchTarget": 10129813
  },
  {
    "opcode": 166,
    "instructionAddress": 10022859,
    "expectedBranchTarget": 10021669
  },
  {
    "opcode": 4,
    "instructionAddress": 10019619,
    "expectedBranchTarget": 10019634
  },
  {
    "opcode": 9,
    "instructionAddress": 9822926,
    "expectedBranchTarget": 9823013
  },
  {
    "opcode": 9,
    "instructionAddress": 9816943,
    "expectedBranchTarget": 9816974
  },
  {
    "opcode": 9,
    "instructionAddress": 9685214,
    "expectedBranchTarget": 9685229
  },
  {
    "opcode": 41,
    "instructionAddress": 10012131,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 9946435,
    "expectedBranchTarget": 9946450
  },
  {
    "opcode": 4,
    "instructionAddress": 9739135,
    "expectedBranchTarget": 9739142
  },
  {
    "opcode": 9,
    "instructionAddress": 9822863,
    "expectedBranchTarget": 9822887
  },
  {
    "opcode": 4,
    "instructionAddress": 9744907,
    "expectedBranchTarget": 9744914
  },
  {
    "opcode": 8,
    "instructionAddress": 9672233,
    "expectedBranchTarget": 9672249
  },
  {
    "opcode": 9,
    "instructionAddress": 10214533,
    "expectedBranchTarget": 10214544
  },
  {
    "opcode": 9,
    "instructionAddress": 9998399,
    "expectedBranchTarget": 9998419
  },
  {
    "opcode": 166,
    "instructionAddress": 10063037,
    "expectedBranchTarget": 10062146
  },
  {
    "opcode": 9,
    "instructionAddress": 9733826,
    "expectedBranchTarget": 9733836
  },
  {
    "opcode": 9,
    "instructionAddress": 9752563,
    "expectedBranchTarget": 9752595
  },
  {
    "opcode": 9,
    "instructionAddress": 9819350,
    "expectedBranchTarget": 9819362
  },
  {
    "opcode": 8,
    "instructionAddress": 9738816,
    "expectedBranchTarget": 9738852
  },
  {
    "opcode": 41,
    "instructionAddress": 9691389,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 9733238,
    "expectedBranchTarget": 9733259
  },
  {
    "opcode": 4,
    "instructionAddress": 10007358,
    "expectedBranchTarget": 10007365
  },
  {
    "opcode": 9,
    "instructionAddress": 9804561,
    "expectedBranchTarget": 9804575
  },
  {
    "opcode": 4,
    "instructionAddress": 10190959,
    "expectedBranchTarget": 10190989
  },
  {
    "opcode": 8,
    "instructionAddress": 9688112,
    "expectedBranchTarget": 9688135
  },
  {
    "opcode": 9,
    "instructionAddress": 9948022,
    "expectedBranchTarget": 9948036
  },
  {
    "opcode": 9,
    "instructionAddress": 10192654,
    "expectedBranchTarget": 10192669
  },
  {
    "opcode": 166,
    "instructionAddress": 9883574,
    "expectedBranchTarget": 9882985
  },
  {
    "opcode": 8,
    "instructionAddress": 9738855,
    "expectedBranchTarget": 9738891
  },
  {
    "opcode": 8,
    "instructionAddress": 9742242,
    "expectedBranchTarget": 9742256
  },
  {
    "opcode": 9,
    "instructionAddress": 9946624,
    "expectedBranchTarget": 9946755
  },
  {
    "opcode": 9,
    "instructionAddress": 10146783,
    "expectedBranchTarget": 10146802
  },
  {
    "opcode": 9,
    "instructionAddress": 10191067,
    "expectedBranchTarget": 10191077
  },
  {
    "opcode": 9,
    "instructionAddress": 10088076,
    "expectedBranchTarget": 10088097
  },
  {
    "opcode": 9,
    "instructionAddress": 9948262,
    "expectedBranchTarget": 9948378
  },
  {
    "opcode": 4,
    "instructionAddress": 9744987,
    "expectedBranchTarget": 9744994
  },
  {
    "opcode": 9,
    "instructionAddress": 9668190,
    "expectedBranchTarget": 9668200
  },
  {
    "opcode": 9,
    "instructionAddress": 10146844,
    "expectedBranchTarget": 10146855
  },
  {
    "opcode": 165,
    "instructionAddress": 9683832,
    "expectedBranchTarget": 9683585
  },
  {
    "opcode": 4,
    "instructionAddress": 10142744,
    "expectedBranchTarget": 10142770
  },
  {
    "opcode": 9,
    "instructionAddress": 10087822,
    "expectedBranchTarget": 10087848
  },
  {
    "opcode": 9,
    "instructionAddress": 10019132,
    "expectedBranchTarget": 10019281
  },
  {
    "opcode": 8,
    "instructionAddress": 9822626,
    "expectedBranchTarget": 9822662
  },
  {
    "opcode": 4,
    "instructionAddress": 10194881,
    "expectedBranchTarget": 10194888
  },
  {
    "opcode": 8,
    "instructionAddress": 9747928,
    "expectedBranchTarget": 9747940
  },
  {
    "opcode": 4,
    "instructionAddress": 9798875,
    "expectedBranchTarget": 9798930
  },
  {
    "opcode": 4,
    "instructionAddress": 9757223,
    "expectedBranchTarget": 9757228
  },
  {
    "opcode": 4,
    "instructionAddress": 9996998,
    "expectedBranchTarget": 9997135
  },
  {
    "opcode": 9,
    "instructionAddress": 9627146,
    "expectedBranchTarget": 9627168
  },
  {
    "opcode": 4,
    "instructionAddress": 10190974,
    "expectedBranchTarget": 10190989
  },
  {
    "opcode": 9,
    "instructionAddress": 9946755,
    "expectedBranchTarget": 9946771
  },
  {
    "opcode": 4,
    "instructionAddress": 9822397,
    "expectedBranchTarget": 9822404
  },
  {
    "opcode": 4,
    "instructionAddress": 9743600,
    "expectedBranchTarget": 9743607
  },
  {
    "opcode": 9,
    "instructionAddress": 9742300,
    "expectedBranchTarget": 9742326
  },
  {
    "opcode": 4,
    "instructionAddress": 9757838,
    "expectedBranchTarget": 9757844
  },
  {
    "opcode": 9,
    "instructionAddress": 9822815,
    "expectedBranchTarget": 9822839
  },
  {
    "opcode": 8,
    "instructionAddress": 10082753,
    "expectedBranchTarget": 10082763
  },
  {
    "opcode": 4,
    "instructionAddress": 10013452,
    "expectedBranchTarget": 10013468
  },
  {
    "opcode": 9,
    "instructionAddress": 9877536,
    "expectedBranchTarget": 9877552
  },
  {
    "opcode": 9,
    "instructionAddress": 10145791,
    "expectedBranchTarget": 10145833
  },
  {
    "opcode": 9,
    "instructionAddress": 9758131,
    "expectedBranchTarget": 9758141
  },
  {
    "opcode": 9,
    "instructionAddress": 10146828,
    "expectedBranchTarget": 10146844
  },
  {
    "opcode": 9,
    "instructionAddress": 9757659,
    "expectedBranchTarget": 9757709
  },
  {
    "opcode": 41,
    "instructionAddress": 9946513,
    "expectedBranchTarget": 9610215
  },
  {
    "opcode": 4,
    "instructionAddress": 9683875,
    "expectedBranchTarget": 9683881
  },
  {
    "opcode": 9,
    "instructionAddress": 10006898,
    "expectedBranchTarget": 10006913
  },
  {
    "opcode": 4,
    "instructionAddress": 9823509,
    "expectedBranchTarget": 9823516
  },
  {
    "opcode": 9,
    "instructionAddress": 9946503,
    "expectedBranchTarget": 9946624
  },
  {
    "opcode": 9,
    "instructionAddress": 9759523,
    "expectedBranchTarget": 9759538
  },
  {
    "opcode": 4,
    "instructionAddress": 10140782,
    "expectedBranchTarget": 10140789
  },
  {
    "opcode": 8,
    "instructionAddress": 9822414,
    "expectedBranchTarget": 9822476
  },
  {
    "opcode": 9,
    "instructionAddress": 10214544,
    "expectedBranchTarget": 10214555
  },
  {
    "opcode": 166,
    "instructionAddress": 9810907,
    "expectedBranchTarget": 9810302
  },
  {
    "opcode": 9,
    "instructionAddress": 9877190,
    "expectedBranchTarget": 9877204
  },
  {
    "opcode": 8,
    "instructionAddress": 10082763,
    "expectedBranchTarget": 10082773
  },
  {
    "opcode": 8,
    "instructionAddress": 9877631,
    "expectedBranchTarget": 9877638
  },
  {
    "opcode": 9,
    "instructionAddress": 10019290,
    "expectedBranchTarget": 10019395
  },
  {
    "opcode": 9,
    "instructionAddress": 9740756,
    "expectedBranchTarget": 9740780
  },
  {
    "opcode": 8,
    "instructionAddress": 10142731,
    "expectedBranchTarget": 10142744
  },
  {
    "opcode": 9,
    "instructionAddress": 10077124,
    "expectedBranchTarget": 10077136
  },
  {
    "opcode": 9,
    "instructionAddress": 9818094,
    "expectedBranchTarget": 9818130
  },
  {
    "opcode": 41,
    "instructionAddress": 9742749,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 41,
    "instructionAddress": 9671168,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 166,
    "instructionAddress": 9998670,
    "expectedBranchTarget": 9997974
  },
  {
    "opcode": 4,
    "instructionAddress": 9932356,
    "expectedBranchTarget": 9932363
  },
  {
    "opcode": 4,
    "instructionAddress": 10018624,
    "expectedBranchTarget": 10018635
  },
  {
    "opcode": 9,
    "instructionAddress": 9736734,
    "expectedBranchTarget": 9736796
  },
  {
    "opcode": 8,
    "instructionAddress": 9743589,
    "expectedBranchTarget": 9743603
  },
  {
    "opcode": 9,
    "instructionAddress": 10008632,
    "expectedBranchTarget": 10008672
  },
  {
    "opcode": 4,
    "instructionAddress": 10129408,
    "expectedBranchTarget": 10129419
  },
  {
    "opcode": 41,
    "instructionAddress": 10126192,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 10129301,
    "expectedBranchTarget": 10129315
  },
  {
    "opcode": 9,
    "instructionAddress": 9824639,
    "expectedBranchTarget": 9824681
  },
  {
    "opcode": 41,
    "instructionAddress": 10020945,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 9736822,
    "expectedBranchTarget": 9736848
  },
  {
    "opcode": 8,
    "instructionAddress": 9808108,
    "expectedBranchTarget": 9808124
  },
  {
    "opcode": 4,
    "instructionAddress": 9670971,
    "expectedBranchTarget": 9670978
  },
  {
    "opcode": 9,
    "instructionAddress": 9996927,
    "expectedBranchTarget": 9996965
  },
  {
    "opcode": 9,
    "instructionAddress": 9814485,
    "expectedBranchTarget": 9814503
  },
  {
    "opcode": 9,
    "instructionAddress": 9747916,
    "expectedBranchTarget": 9747928
  },
  {
    "opcode": 8,
    "instructionAddress": 10193160,
    "expectedBranchTarget": 10193200
  },
  {
    "opcode": 166,
    "instructionAddress": 10001583,
    "expectedBranchTarget": 9999927
  },
  {
    "opcode": 9,
    "instructionAddress": 10076998,
    "expectedBranchTarget": 10077027
  },
  {
    "opcode": 9,
    "instructionAddress": 9885249,
    "expectedBranchTarget": 9885259
  },
  {
    "opcode": 9,
    "instructionAddress": 9742326,
    "expectedBranchTarget": 9742352
  },
  {
    "opcode": 166,
    "instructionAddress": 10063210,
    "expectedBranchTarget": 10061508
  },
  {
    "opcode": 9,
    "instructionAddress": 9739104,
    "expectedBranchTarget": 9739124
  },
  {
    "opcode": 4,
    "instructionAddress": 9819251,
    "expectedBranchTarget": 9819272
  },
  {
    "opcode": 9,
    "instructionAddress": 9757758,
    "expectedBranchTarget": 9757780
  },
  {
    "opcode": 4,
    "instructionAddress": 10214520,
    "expectedBranchTarget": 10214527
  },
  {
    "opcode": 4,
    "instructionAddress": 9758218,
    "expectedBranchTarget": 9758225
  },
  {
    "opcode": 9,
    "instructionAddress": 9822725,
    "expectedBranchTarget": 9822751
  },
  {
    "opcode": 9,
    "instructionAddress": 9757872,
    "expectedBranchTarget": 9757882
  },
  {
    "opcode": 4,
    "instructionAddress": 9809942,
    "expectedBranchTarget": 9810129
  },
  {
    "opcode": 9,
    "instructionAddress": 9738894,
    "expectedBranchTarget": 9738907
  },
  {
    "opcode": 9,
    "instructionAddress": 9694489,
    "expectedBranchTarget": 9694502
  },
  {
    "opcode": 9,
    "instructionAddress": 9932344,
    "expectedBranchTarget": 9932359
  },
  {
    "opcode": 4,
    "instructionAddress": 10076995,
    "expectedBranchTarget": 10077052
  },
  {
    "opcode": 9,
    "instructionAddress": 9748094,
    "expectedBranchTarget": 9748108
  },
  {
    "opcode": 166,
    "instructionAddress": 9757841,
    "expectedBranchTarget": 9755245
  },
  {
    "opcode": 166,
    "instructionAddress": 9748072,
    "expectedBranchTarget": 9747223
  },
  {
    "opcode": 9,
    "instructionAddress": 9672286,
    "expectedBranchTarget": 9672296
  },
  {
    "opcode": 8,
    "instructionAddress": 9758886,
    "expectedBranchTarget": 9758900
  },
  {
    "opcode": 9,
    "instructionAddress": 9740432,
    "expectedBranchTarget": 9740458
  },
  {
    "opcode": 9,
    "instructionAddress": 9745453,
    "expectedBranchTarget": 9745484
  },
  {
    "opcode": 41,
    "instructionAddress": 9759635,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 10008622,
    "expectedBranchTarget": 10008632
  },
  {
    "opcode": 4,
    "instructionAddress": 9747848,
    "expectedBranchTarget": 9747855
  },
  {
    "opcode": 166,
    "instructionAddress": 9752177,
    "expectedBranchTarget": 9751841
  },
  {
    "opcode": 41,
    "instructionAddress": 10205796,
    "expectedBranchTarget": 9625214
  },
  {
    "opcode": 4,
    "instructionAddress": 10013139,
    "expectedBranchTarget": 10013144
  },
  {
    "opcode": 9,
    "instructionAddress": 10013498,
    "expectedBranchTarget": 10013525
  },
  {
    "opcode": 9,
    "instructionAddress": 9736869,
    "expectedBranchTarget": 9736890
  },
  {
    "opcode": 9,
    "instructionAddress": 9822947,
    "expectedBranchTarget": 9822968
  },
  {
    "opcode": 166,
    "instructionAddress": 10146006,
    "expectedBranchTarget": 10143085
  },
  {
    "opcode": 4,
    "instructionAddress": 9814403,
    "expectedBranchTarget": 9814410
  },
  {
    "opcode": 166,
    "instructionAddress": 9934283,
    "expectedBranchTarget": 9933568
  },
  {
    "opcode": 4,
    "instructionAddress": 9812686,
    "expectedBranchTarget": 9812693
  },
  {
    "opcode": 9,
    "instructionAddress": 9802859,
    "expectedBranchTarget": 9802878
  },
  {
    "opcode": 9,
    "instructionAddress": 9745212,
    "expectedBranchTarget": 9745258
  },
  {
    "opcode": 8,
    "instructionAddress": 9810767,
    "expectedBranchTarget": 9810781
  },
  {
    "opcode": 9,
    "instructionAddress": 10192382,
    "expectedBranchTarget": 10192549
  },
  {
    "opcode": 4,
    "instructionAddress": 9740325,
    "expectedBranchTarget": 9740559
  },
  {
    "opcode": 9,
    "instructionAddress": 10063200,
    "expectedBranchTarget": 10063216
  },
  {
    "opcode": 9,
    "instructionAddress": 9877672,
    "expectedBranchTarget": 9877688
  },
  {
    "opcode": 9,
    "instructionAddress": 10205758,
    "expectedBranchTarget": 10205771
  },
  {
    "opcode": 9,
    "instructionAddress": 9748063,
    "expectedBranchTarget": 9748078
  },
  {
    "opcode": 41,
    "instructionAddress": 10013484,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 9885232,
    "expectedBranchTarget": 9885245
  },
  {
    "opcode": 9,
    "instructionAddress": 10142707,
    "expectedBranchTarget": 10142717
  },
  {
    "opcode": 8,
    "instructionAddress": 9819170,
    "expectedBranchTarget": 9819180
  },
  {
    "opcode": 4,
    "instructionAddress": 10008611,
    "expectedBranchTarget": 10008618
  },
  {
    "opcode": 8,
    "instructionAddress": 9804532,
    "expectedBranchTarget": 9804612
  },
  {
    "opcode": 166,
    "instructionAddress": 9757835,
    "expectedBranchTarget": 9754118
  },
  {
    "opcode": 166,
    "instructionAddress": 9877766,
    "expectedBranchTarget": 9825045
  },
  {
    "opcode": 4,
    "instructionAddress": 10019065,
    "expectedBranchTarget": 10019076
  },
  {
    "opcode": 8,
    "instructionAddress": 9745167,
    "expectedBranchTarget": 9745179
  },
  {
    "opcode": 9,
    "instructionAddress": 9877508,
    "expectedBranchTarget": 9877519
  },
  {
    "opcode": 9,
    "instructionAddress": 9877618,
    "expectedBranchTarget": 9877627
  },
  {
    "opcode": 9,
    "instructionAddress": 9812934,
    "expectedBranchTarget": 9812960
  },
  {
    "opcode": 4,
    "instructionAddress": 9691174,
    "expectedBranchTarget": 9691181
  },
  {
    "opcode": 166,
    "instructionAddress": 10008746,
    "expectedBranchTarget": 10007877
  },
  {
    "opcode": 9,
    "instructionAddress": 9948256,
    "expectedBranchTarget": 9948378
  },
  {
    "opcode": 41,
    "instructionAddress": 9758145,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 10128405,
    "expectedBranchTarget": 10128415
  },
  {
    "opcode": 4,
    "instructionAddress": 10193127,
    "expectedBranchTarget": 10193134
  },
  {
    "opcode": 9,
    "instructionAddress": 9745531,
    "expectedBranchTarget": 9745562
  },
  {
    "opcode": 9,
    "instructionAddress": 10019578,
    "expectedBranchTarget": 10019634
  },
  {
    "opcode": 9,
    "instructionAddress": 10142596,
    "expectedBranchTarget": 10142630
  },
  {
    "opcode": 166,
    "instructionAddress": 9688226,
    "expectedBranchTarget": 9685621
  },
  {
    "opcode": 4,
    "instructionAddress": 9757844,
    "expectedBranchTarget": 9757860
  },
  {
    "opcode": 41,
    "instructionAddress": 9627180,
    "expectedBranchTarget": 9610195
  },
  {
    "opcode": 9,
    "instructionAddress": 9937787,
    "expectedBranchTarget": 9937797
  },
  {
    "opcode": 166,
    "instructionAddress": 9946819,
    "expectedBranchTarget": 9946360
  },
  {
    "opcode": 41,
    "instructionAddress": 9998676,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 4,
    "instructionAddress": 10083216,
    "expectedBranchTarget": 10083223
  },
  {
    "opcode": 9,
    "instructionAddress": 9757230,
    "expectedBranchTarget": 9757278
  },
  {
    "opcode": 41,
    "instructionAddress": 9627137,
    "expectedBranchTarget": 9623521
  },
  {
    "opcode": 165,
    "instructionAddress": 9678689,
    "expectedBranchTarget": 9678466
  },
  {
    "opcode": 9,
    "instructionAddress": 9814864,
    "expectedBranchTarget": 9814871
  },
  {
    "opcode": 4,
    "instructionAddress": 9758092,
    "expectedBranchTarget": 9758099
  },
  {
    "opcode": 8,
    "instructionAddress": 10060620,
    "expectedBranchTarget": 10060630
  },
  {
    "opcode": 9,
    "instructionAddress": 9809915,
    "expectedBranchTarget": 9809930
  },
  {
    "opcode": 166,
    "instructionAddress": 9944891,
    "expectedBranchTarget": 9940912
  },
  {
    "opcode": 9,
    "instructionAddress": 9951706,
    "expectedBranchTarget": 9951744
  },
  {
    "opcode": 4,
    "instructionAddress": 10064778,
    "expectedBranchTarget": 10064785
  },
  {
    "opcode": 9,
    "instructionAddress": 9946775,
    "expectedBranchTarget": 9946872
  },
  {
    "opcode": 9,
    "instructionAddress": 10011727,
    "expectedBranchTarget": 10011916
  },
  {
    "opcode": 9,
    "instructionAddress": 9887743,
    "expectedBranchTarget": 9887768
  },
  {
    "opcode": 8,
    "instructionAddress": 9745331,
    "expectedBranchTarget": 9745343
  },
  {
    "opcode": 9,
    "instructionAddress": 9948036,
    "expectedBranchTarget": 9948059
  },
  {
    "opcode": 166,
    "instructionAddress": 9742768,
    "expectedBranchTarget": 9741146
  },
  {
    "opcode": 9,
    "instructionAddress": 9685153,
    "expectedBranchTarget": 9685234
  },
  {
    "opcode": 9,
    "instructionAddress": 9683985,
    "expectedBranchTarget": 9683995
  },
  {
    "opcode": 4,
    "instructionAddress": 10205768,
    "expectedBranchTarget": 10205775
  },
  {
    "opcode": 9,
    "instructionAddress": 9824537,
    "expectedBranchTarget": 9824552
  },
  {
    "opcode": 9,
    "instructionAddress": 9824593,
    "expectedBranchTarget": 9824603
  },
  {
    "opcode": 166,
    "instructionAddress": 9885310,
    "expectedBranchTarget": 9883943
  },
  {
    "opcode": 4,
    "instructionAddress": 9758897,
    "expectedBranchTarget": 9758904
  },
  {
    "opcode": 9,
    "instructionAddress": 10064756,
    "expectedBranchTarget": 10064781
  },
  {
    "opcode": 9,
    "instructionAddress": 9948234,
    "expectedBranchTarget": 9948378
  },
  {
    "opcode": 9,
    "instructionAddress": 9948003,
    "expectedBranchTarget": 9948018
  },
  {
    "opcode": 9,
    "instructionAddress": 10013293,
    "expectedBranchTarget": 10013395
  },
  {
    "opcode": 4,
    "instructionAddress": 9822812,
    "expectedBranchTarget": 9822926
  },
  {
    "opcode": 4,
    "instructionAddress": 9740252,
    "expectedBranchTarget": 9740259
  },
  {
    "opcode": 9,
    "instructionAddress": 10018688,
    "expectedBranchTarget": 10018705
  },
  {
    "opcode": 4,
    "instructionAddress": 9740351,
    "expectedBranchTarget": 9740559
  },
  {
    "opcode": 9,
    "instructionAddress": 9740276,
    "expectedBranchTarget": 9740302
  },
  {
    "opcode": 4,
    "instructionAddress": 9996633,
    "expectedBranchTarget": 9996640
  },
  {
    "opcode": 9,
    "instructionAddress": 10138487,
    "expectedBranchTarget": 10138530
  },
  {
    "opcode": 9,
    "instructionAddress": 9679492,
    "expectedBranchTarget": 9679502
  },
  {
    "opcode": 41,
    "instructionAddress": 10079795,
    "expectedBranchTarget": 10081180
  },
  {
    "opcode": 4,
    "instructionAddress": 9745191,
    "expectedBranchTarget": 9745197
  },
  {
    "opcode": 8,
    "instructionAddress": 9810733,
    "expectedBranchTarget": 9810747
  },
  {
    "opcode": 166,
    "instructionAddress": 9757879,
    "expectedBranchTarget": 9755883
  },
  {
    "opcode": 4,
    "instructionAddress": 9668045,
    "expectedBranchTarget": 9668052
  },
  {
    "opcode": 41,
    "instructionAddress": 10013511,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 41,
    "instructionAddress": 9883727,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 9937836,
    "expectedBranchTarget": 9937864
  },
  {
    "opcode": 8,
    "instructionAddress": 9758617,
    "expectedBranchTarget": 9758631
  },
  {
    "opcode": 9,
    "instructionAddress": 9877688,
    "expectedBranchTarget": 9877702
  },
  {
    "opcode": 41,
    "instructionAddress": 10198938,
    "expectedBranchTarget": 9625214
  },
  {
    "opcode": 4,
    "instructionAddress": 9740533,
    "expectedBranchTarget": 9740559
  },
  {
    "opcode": 41,
    "instructionAddress": 9934263,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 10019161,
    "expectedBranchTarget": 10019192
  },
  {
    "opcode": 41,
    "instructionAddress": 9734561,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 4,
    "instructionAddress": 10125750,
    "expectedBranchTarget": 10125757
  },
  {
    "opcode": 4,
    "instructionAddress": 10088119,
    "expectedBranchTarget": 10088142
  },
  {
    "opcode": 41,
    "instructionAddress": 9626945,
    "expectedBranchTarget": 9610213
  },
  {
    "opcode": 9,
    "instructionAddress": 10019012,
    "expectedBranchTarget": 10019079
  },
  {
    "opcode": 4,
    "instructionAddress": 9948391,
    "expectedBranchTarget": 9948427
  },
  {
    "opcode": 9,
    "instructionAddress": 9945429,
    "expectedBranchTarget": 9945546
  },
  {
    "opcode": 41,
    "instructionAddress": 9953038,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 8,
    "instructionAddress": 9878744,
    "expectedBranchTarget": 9878758
  },
  {
    "opcode": 9,
    "instructionAddress": 9885128,
    "expectedBranchTarget": 9885143
  },
  {
    "opcode": 41,
    "instructionAddress": 9819316,
    "expectedBranchTarget": 9610215
  },
  {
    "opcode": 9,
    "instructionAddress": 9747954,
    "expectedBranchTarget": 9747988
  },
  {
    "opcode": 9,
    "instructionAddress": 9808139,
    "expectedBranchTarget": 9808149
  },
  {
    "opcode": 4,
    "instructionAddress": 9745340,
    "expectedBranchTarget": 9745346
  },
  {
    "opcode": 9,
    "instructionAddress": 9740380,
    "expectedBranchTarget": 9740406
  },
  {
    "opcode": 41,
    "instructionAddress": 10129459,
    "expectedBranchTarget": 9623331
  },
  {
    "opcode": 9,
    "instructionAddress": 10011966,
    "expectedBranchTarget": 10012036
  },
  {
    "opcode": 9,
    "instructionAddress": 10198862,
    "expectedBranchTarget": 10198872
  },
  {
    "opcode": 166,
    "instructionAddress": 9802872,
    "expectedBranchTarget": 9801778
  },
  {
    "opcode": 9,
    "instructionAddress": 10011639,
    "expectedBranchTarget": 10011654
  },
  {
    "opcode": 9,
    "instructionAddress": 9733793,
    "expectedBranchTarget": 9733808
  },
  {
    "opcode": 4,
    "instructionAddress": 10129154,
    "expectedBranchTarget": 10129167
  },
  {
    "opcode": 4,
    "instructionAddress": 9946683,
    "expectedBranchTarget": 9946716
  },
  {
    "opcode": 166,
    "instructionAddress": 9998649,
    "expectedBranchTarget": 9997969
  },
  {
    "opcode": 9,
    "instructionAddress": 9940676,
    "expectedBranchTarget": 9940691
  },
  {
    "opcode": 166,
    "instructionAddress": 10140436,
    "expectedBranchTarget": 10138819
  },
  {
    "opcode": 4,
    "instructionAddress": 9878755,
    "expectedBranchTarget": 9878762
  },
  {
    "opcode": 4,
    "instructionAddress": 10013155,
    "expectedBranchTarget": 10013160
  },
  {
    "opcode": 41,
    "instructionAddress": 9626528,
    "expectedBranchTarget": 9610221
  },
  {
    "opcode": 166,
    "instructionAddress": 9688147,
    "expectedBranchTarget": 9685621
  },
  {
    "opcode": 41,
    "instructionAddress": 10192378,
    "expectedBranchTarget": 10192670
  },
  {
    "opcode": 9,
    "instructionAddress": 10191019,
    "expectedBranchTarget": 10191031
  },
  {
    "opcode": 41,
    "instructionAddress": 9997064,
    "expectedBranchTarget": 9610215
  },
  {
    "opcode": 166,
    "instructionAddress": 9688072,
    "expectedBranchTarget": 9684983
  },
  {
    "opcode": 9,
    "instructionAddress": 10192372,
    "expectedBranchTarget": 10192382
  },
  {
    "opcode": 8,
    "instructionAddress": 9688066,
    "expectedBranchTarget": 9688089
  },
  {
    "opcode": 4,
    "instructionAddress": 10079467,
    "expectedBranchTarget": 10079474
  },
  {
    "opcode": 4,
    "instructionAddress": 9814857,
    "expectedBranchTarget": 9814864
  },
  {
    "opcode": 9,
    "instructionAddress": 9812839,
    "expectedBranchTarget": 9812968
  },
  {
    "opcode": 9,
    "instructionAddress": 9742652,
    "expectedBranchTarget": 9742669
  },
  {
    "opcode": 9,
    "instructionAddress": 10192362,
    "expectedBranchTarget": 10192372
  },
  {
    "opcode": 9,
    "instructionAddress": 10013162,
    "expectedBranchTarget": 10013180
  },
  {
    "opcode": 4,
    "instructionAddress": 10019122,
    "expectedBranchTarget": 10019129
  },
  {
    "opcode": 4,
    "instructionAddress": 9740481,
    "expectedBranchTarget": 9740559
  },
  {
    "opcode": 9,
    "instructionAddress": 9688186,
    "expectedBranchTarget": 9688233
  },
  {
    "opcode": 9,
    "instructionAddress": 9626873,
    "expectedBranchTarget": 9626899
  },
  {
    "opcode": 166,
    "instructionAddress": 10146774,
    "expectedBranchTarget": 10146460
  },
  {
    "opcode": 9,
    "instructionAddress": 9822803,
    "expectedBranchTarget": 9822815
  },
  {
    "opcode": 4,
    "instructionAddress": 10019278,
    "expectedBranchTarget": 10019634
  },
  {
    "opcode": 4,
    "instructionAddress": 9747903,
    "expectedBranchTarget": 9747910
  },
  {
    "opcode": 166,
    "instructionAddress": 10079632,
    "expectedBranchTarget": 10077183
  },
  {
    "opcode": 9,
    "instructionAddress": 10190935,
    "expectedBranchTarget": 10190947
  },
  {
    "opcode": 9,
    "instructionAddress": 9877556,
    "expectedBranchTarget": 9877652
  },
  {
    "opcode": 4,
    "instructionAddress": 9877112,
    "expectedBranchTarget": 9877128
  },
  {
    "opcode": 166,
    "instructionAddress": 9934059,
    "expectedBranchTarget": 9933205
  },
  {
    "opcode": 4,
    "instructionAddress": 9945368,
    "expectedBranchTarget": 9945375
  },
  {
    "opcode": 8,
    "instructionAddress": 10079731,
    "expectedBranchTarget": 10079760
  },
  {
    "opcode": 4,
    "instructionAddress": 9757321,
    "expectedBranchTarget": 9757780
  },
  {
    "opcode": 41,
    "instructionAddress": 9823713,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 8,
    "instructionAddress": 9684448,
    "expectedBranchTarget": 9684462
  },
  {
    "opcode": 9,
    "instructionAddress": 9626686,
    "expectedBranchTarget": 9626696
  },
  {
    "opcode": 4,
    "instructionAddress": 10020891,
    "expectedBranchTarget": 10020898
  },
  {
    "opcode": 9,
    "instructionAddress": 9742462,
    "expectedBranchTarget": 9742480
  },
  {
    "opcode": 166,
    "instructionAddress": 9759649,
    "expectedBranchTarget": 9759192
  },
  {
    "opcode": 41,
    "instructionAddress": 9757800,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 10146022,
    "expectedBranchTarget": 10146062
  },
  {
    "opcode": 4,
    "instructionAddress": 9953035,
    "expectedBranchTarget": 9953042
  },
  {
    "opcode": 9,
    "instructionAddress": 9757502,
    "expectedBranchTarget": 9757544
  },
  {
    "opcode": 166,
    "instructionAddress": 10082779,
    "expectedBranchTarget": 10081678
  },
  {
    "opcode": 166,
    "instructionAddress": 10198876,
    "expectedBranchTarget": 10198174
  },
  {
    "opcode": 41,
    "instructionAddress": 9997131,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 10146768,
    "expectedBranchTarget": 10146778
  },
  {
    "opcode": 9,
    "instructionAddress": 9814506,
    "expectedBranchTarget": 9814549
  },
  {
    "opcode": 9,
    "instructionAddress": 9814812,
    "expectedBranchTarget": 9814836
  },
  {
    "opcode": 8,
    "instructionAddress": 10128656,
    "expectedBranchTarget": 10128672
  },
  {
    "opcode": 165,
    "instructionAddress": 9747938,
    "expectedBranchTarget": 9747776
  },
  {
    "opcode": 9,
    "instructionAddress": 10214583,
    "expectedBranchTarget": 10214608
  },
  {
    "opcode": 4,
    "instructionAddress": 9745316,
    "expectedBranchTarget": 9745322
  },
  {
    "opcode": 4,
    "instructionAddress": 10142642,
    "expectedBranchTarget": 10142649
  },
  {
    "opcode": 4,
    "instructionAddress": 10006910,
    "expectedBranchTarget": 10006917
  },
  {
    "opcode": 9,
    "instructionAddress": 9810190,
    "expectedBranchTarget": 9810214
  },
  {
    "opcode": 9,
    "instructionAddress": 9679294,
    "expectedBranchTarget": 9679302
  },
  {
    "opcode": 166,
    "instructionAddress": 10145749,
    "expectedBranchTarget": 10144958
  },
  {
    "opcode": 166,
    "instructionAddress": 9887877,
    "expectedBranchTarget": 9885391
  },
  {
    "opcode": 4,
    "instructionAddress": 10018475,
    "expectedBranchTarget": 10018480
  },
  {
    "opcode": 9,
    "instructionAddress": 9819942,
    "expectedBranchTarget": 9819952
  },
  {
    "opcode": 4,
    "instructionAddress": 10146799,
    "expectedBranchTarget": 10146806
  },
  {
    "opcode": 9,
    "instructionAddress": 10013125,
    "expectedBranchTarget": 10013147
  },
  {
    "opcode": 4,
    "instructionAddress": 9999731,
    "expectedBranchTarget": 9999763
  },
  {
    "opcode": 41,
    "instructionAddress": 9758935,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 4,
    "instructionAddress": 10006722,
    "expectedBranchTarget": 10006729
  },
  {
    "opcode": 9,
    "instructionAddress": 9945509,
    "expectedBranchTarget": 9945546
  },
  {
    "opcode": 9,
    "instructionAddress": 9804321,
    "expectedBranchTarget": 9804359
  },
  {
    "opcode": 9,
    "instructionAddress": 10088157,
    "expectedBranchTarget": 10088172
  },
  {
    "opcode": 9,
    "instructionAddress": 10145848,
    "expectedBranchTarget": 10145884
  },
  {
    "opcode": 41,
    "instructionAddress": 9804604,
    "expectedBranchTarget": 9610274
  },
  {
    "opcode": 9,
    "instructionAddress": 10064768,
    "expectedBranchTarget": 10064778
  },
  {
    "opcode": 4,
    "instructionAddress": 10146689,
    "expectedBranchTarget": 10146696
  },
  {
    "opcode": 9,
    "instructionAddress": 10190879,
    "expectedBranchTarget": 10190889
  },
  {
    "opcode": 4,
    "instructionAddress": 9998431,
    "expectedBranchTarget": 9998438
  },
  {
    "opcode": 4,
    "instructionAddress": 9738888,
    "expectedBranchTarget": 9738894
  },
  {
    "opcode": 9,
    "instructionAddress": 10146016,
    "expectedBranchTarget": 10146122
  },
  {
    "opcode": 4,
    "instructionAddress": 9824549,
    "expectedBranchTarget": 9824556
  },
  {
    "opcode": 4,
    "instructionAddress": 9684459,
    "expectedBranchTarget": 9684466
  },
  {
    "opcode": 9,
    "instructionAddress": 9822887,
    "expectedBranchTarget": 9822926
  },
  {
    "opcode": 166,
    "instructionAddress": 10128567,
    "expectedBranchTarget": 10126428
  },
  {
    "opcode": 41,
    "instructionAddress": 10069945,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 9,
    "instructionAddress": 10019032,
    "expectedBranchTarget": 10019051
  },
  {
    "opcode": 4,
    "instructionAddress": 10134216,
    "expectedBranchTarget": 10134223
  },
  {
    "opcode": 41,
    "instructionAddress": 10214775,
    "expectedBranchTarget": 9625205
  },
  {
    "opcode": 4,
    "instructionAddress": 9745155,
    "expectedBranchTarget": 9745346
  }
];

test('generated branch validation corpus', () => {
  for (const sample of BRANCH_CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.branchTarget, sample.expectedBranchTarget);
  }
});
