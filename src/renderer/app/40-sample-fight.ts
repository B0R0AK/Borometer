import { state } from "./01-state";
import { t } from "./08-translation";
import { $ } from "./18-interface-basics";
import { loadText, setLoadingSample, setLoadOrigin } from "./32-history";

/* ---------- sample ---------- */
/* Two real fights, cut whole out of two combat logs: eighty-six seconds on
   Dragaryle and seventy on Ramux. This used to be a fight fabricated from
   Math.random(), so the one thing somebody clicks it to see — what a real
   rotation, real crit rates and real skill ids look like in here — was the
   one thing it could not show. Nothing is trimmed or rounded; only the
   character name is replaced, because this ships to everyone. */
export const SAMPLE_LOG = `CombatLogVersion,4
20260909-18:36:42:163,DamageDone,Detonation Mark,953174691,7000,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:42:198,DamageDone,Detonation Mark,953174691,6238,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:42:198,DamageDone,Detonation Mark,953174691,2109,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:42:492,DamageDone,Mother Nature's Protest,963754730,490,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:42:509,DamageDone,Roxie's Arrowhead,947532344,3125,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:42:509,DamageDone,Mother Nature's Protest,963754730,408,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:42:526,DamageDone,Ensnaring Arrow,963973967,1222,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:42:526,DamageDone,Mother Nature's Protest,963754730,490,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:42:823,DamageDone,Quick Fire,964696731,16450,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:42:838,DamageDone,Mother Nature's Protest,963754730,89,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:42:838,DamageDone,Mother Nature's Protest,963754730,12,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:42:838,DamageDone,Quick Fire,964696731,4040,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:42:891,DamageDone,Storm Current,952531070,237,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:42:926,DamageDone,Quick Fire,964696731,3429,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:42:926,DamageDone,Storm Current,952531070,563,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:42:995,DamageDone,Storm Current,952531070,183,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:43:032,DamageDone,Quick Fire,964696731,8625,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:43:066,DamageDone,Quick Fire,964696731,6286,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:43:100,DamageDone,Storm Current,952531070,237,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:43:100,DamageDone,Mother Nature's Protest,963754730,237,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:43:100,DamageDone,Mother Nature's Protest,963754730,21,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:43:134,DamageDone,Mother Nature's Protest,963754730,470,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:43:151,DamageDone,Storm Current,952531070,569,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:43:220,DamageDone,Mother Nature's Protest,963754730,294,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:43:220,DamageDone,Mother Nature's Protest,963754730,6,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:43:307,DamageDone,Mother Nature's Protest,963754730,69,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:43:376,DamageDone,Mother Nature's Protest,963754730,215,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:43:376,DamageDone,Mother Nature's Protest,963754730,32,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:44:379,DamageDone,Mother Nature's Protest,963754730,104,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:44:971,DamageDone,Decisive Sniping,964631505,183342,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:44:971,DamageDone,Storm Current,952531070,281,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:45:178,DamageDone,Mother Nature's Protest,963754730,708,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:45:178,DamageDone,Mother Nature's Protest,963754730,86,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:45:247,DamageDone,Basic Shot,947551927,4051,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:45:404,DamageDone,Storm Current,952531070,198,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:45:506,DamageDone,Basic Shot,947523317,4052,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:45:575,DamageDone,Mother Nature's Protest,963754730,708,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:45:575,DamageDone,Mother Nature's Protest,963754730,40,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:45:609,DamageDone,Storm Current,952531070,300,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:45:801,DamageDone,Mother Nature's Protest,963754730,708,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:45:801,DamageDone,Mother Nature's Protest,963754730,38,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:45:835,DamageDone,Detonation Mark,953174691,163809,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:45:887,DamageDone,Decisive Sniping,964631505,36747,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:45:887,DamageDone,Decisive Sniping,964631505,87167,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:45:887,DamageDone,Decisive Sniping,964631505,87167,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:45:921,DamageDone,Storm Current,952531070,300,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:45:921,DamageDone,Storm Current,952531070,714,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:45:921,DamageDone,Storm Current,952531070,96,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:45:921,DamageDone,Storm Current,952531070,300,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:46:026,DamageDone,Decisive Sniping,964631505,94490,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:46:026,DamageDone,Decisive Sniping,964631505,23211,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:46:026,DamageDone,Decisive Sniping,964631505,94490,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:46:043,DamageDone,Storm Current,952531070,82,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:46:043,DamageDone,Storm Current,952531070,300,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:46:043,DamageDone,Storm Current,952531070,300,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:46:152,DamageDone,Mother Nature's Protest,963754730,640,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:46:152,DamageDone,Mother Nature's Protest,963754730,53,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:46:152,DamageDone,Decisive Sniping,964631505,9587,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:46:152,DamageDone,Decisive Sniping,964631505,94490,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:46:152,DamageDone,Decisive Sniping,964631505,55239,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:46:152,DamageDone,Storm Current,952531070,300,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:46:152,DamageDone,Storm Current,952531070,774,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:46:152,DamageDone,Storm Current,952531070,415,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:47:136,DamageDone,Mother Nature's Protest,963754730,238,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:47:240,DamageDone,Decisive Sniping,964631505,61976,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:47:275,DamageDone,Storm Current,952531070,70,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:47:465,DamageDone,Roxie's Arrowhead,947532344,3261,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:47:465,DamageDone,Mother Nature's Protest,963754730,298,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:47:586,DamageDone,Basic Shot,947551927,4315,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:47:638,DamageDone,Blade Storm,945710601,1459,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:47:639,DamageDone,Blade Storm,945710601,6452,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:47:708,DamageDone,Storm Current,952531070,100,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:47:709,DamageDone,Storm Current,952531070,824,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:47:709,DamageDone,Storm Current,952531070,71,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:47:759,DamageDone,Blade Storm,945710601,2585,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:47:759,DamageDone,Blade Storm,945710601,6452,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:47:795,DamageDone,Storm Current,952531070,440,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:47:795,DamageDone,Storm Current,952531070,319,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:47:828,DamageDone,Blade Storm,945710601,3656,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:47:828,DamageDone,Blade Storm,945710601,6452,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:47:881,DamageDone,Storm Current,952531070,319,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:47:881,DamageDone,Storm Current,952531070,319,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:47:918,DamageDone,Mother Nature's Protest,963754730,317,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:47:918,DamageDone,Mother Nature's Protest,963754730,183,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:47:918,DamageDone,Mother Nature's Protest,963754730,489,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:47:918,DamageDone,Mother Nature's Protest,963754730,344,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:47:918,DamageDone,Basic Shot,947523317,0,0,0,kMiss,Demo,Dragaryle
20260909-18:36:47:918,DamageDone,Blade Storm,945710601,6452,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:47:918,DamageDone,Blade Storm,945710601,2229,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:48:022,DamageDone,Storm Current,952531070,361,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:48:022,DamageDone,Storm Current,952531070,319,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:023,DamageDone,Mother Nature's Protest,963754730,817,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:023,DamageDone,Mother Nature's Protest,963754730,34,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:48:023,DamageDone,Mother Nature's Protest,963754730,817,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:040,DamageDone,Blade Storm,945710601,2634,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:48:040,DamageDone,Blade Storm,945710601,2585,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:074,DamageDone,Decisive Sniping,964631505,100231,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:075,DamageDone,Decisive Sniping,964631505,100231,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:075,DamageDone,Decisive Sniping,964631505,100231,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:075,DamageDone,Storm Current,952531070,319,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:075,DamageDone,Storm Current,952531070,457,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:48:075,DamageDone,Storm Current,952531070,156,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:48:110,DamageDone,Roxie's Arrowhead,947532344,8535,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:110,DamageDone,Mother Nature's Protest,963754730,817,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:110,DamageDone,Mother Nature's Protest,963754730,11,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:48:110,DamageDone,Mother Nature's Protest,963754730,817,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:110,DamageDone,Storm Current,952531070,319,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:110,DamageDone,Storm Current,952531070,319,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:196,DamageDone,Mother Nature's Protest,963754730,317,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:196,DamageDone,Mother Nature's Protest,963754730,339,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:48:196,DamageDone,Mother Nature's Protest,963754730,24,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:48:196,DamageDone,Decisive Sniping,964631505,38975,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:196,DamageDone,Decisive Sniping,964631505,10374,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:48:196,DamageDone,Decisive Sniping,964631505,100231,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:196,DamageDone,Storm Current,952531070,344,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:48:196,DamageDone,Storm Current,952531070,824,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:196,DamageDone,Storm Current,952531070,824,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:282,DamageDone,Basic Shot,947457802,1781,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:282,DamageDone,Decisive Sniping,964631505,38975,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:282,DamageDone,Decisive Sniping,964631505,38975,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:282,DamageDone,Decisive Sniping,964631505,100231,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:316,DamageDone,Mother Nature's Protest,963754730,817,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:316,DamageDone,Mother Nature's Protest,963754730,39,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:48:316,DamageDone,Mother Nature's Protest,963754730,817,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:316,DamageDone,Storm Current,952531070,824,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:316,DamageDone,Storm Current,952531070,319,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:317,DamageDone,Storm Current,952531070,319,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:385,DamageDone,Storm Current,952531070,235,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:48:386,DamageDone,Decisive Sniping,964631505,100231,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:386,DamageDone,Decisive Sniping,964631505,38975,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:386,DamageDone,Decisive Sniping,964631505,9585,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:48:420,DamageDone,Storm Current,952531070,218,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:48:420,DamageDone,Storm Current,952531070,159,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:48:420,DamageDone,Storm Current,952531070,319,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:610,DamageDone,Mother Nature's Protest,963754730,317,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:48:610,DamageDone,Mother Nature's Protest,963754730,36,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:49:593,DamageDone,Mother Nature's Protest,963754730,314,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:50:008,DamageDone,Decisive Sniping,964500434,162450,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:50:181,DamageDone,Mother Nature's Protest,963754730,169,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:50:181,DamageDone,Mother Nature's Protest,963754730,153,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:50:284,DamageDone,Basic Shot,947551927,0,0,0,kMiss,Demo,Dragaryle
20260909-18:36:50:336,DamageDone,Detonation Mark,953371309,4205,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:50:460,DamageDone,Deadly Viper,940584840,16,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:50:617,DamageDone,Basic Shot,947523317,1162,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:50:650,DamageDone,Mother Nature's Protest,963754730,190,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:50:650,DamageDone,Mother Nature's Protest,963754730,30,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:50:720,DamageDone,Ensnaring Arrow,963973967,3287,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:50:738,DamageDone,Deadly Viper,940584840,8,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:50:844,DamageDone,Deadly Viper,940584840,10,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:50:844,DamageDone,Decisive Sniping,964500434,38590,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:50:844,DamageDone,Decisive Sniping,964500434,99315,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:50:844,DamageDone,Decisive Sniping,964500434,99315,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:50:844,DamageDone,Deadly Viper,940584840,6,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:50:930,DamageDone,Decisive Sniping,964500434,99315,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:50:930,DamageDone,Decisive Sniping,964500434,99315,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:50:930,DamageDone,Decisive Sniping,964500434,99315,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:50:946,DamageDone,Deadly Viper,940584840,33,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:50:964,DamageDone,Mother Nature's Protest,963754730,328,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:50:964,DamageDone,Mother Nature's Protest,963754730,39,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:51:016,DamageDone,Mother Nature's Protest,963754730,418,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:51:016,DamageDone,Mother Nature's Protest,963754730,20,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:51:051,DamageDone,Decisive Sniping,964500434,99315,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:051,DamageDone,Decisive Sniping,964500434,99315,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:051,DamageDone,Decisive Sniping,964500434,99315,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:051,DamageDone,Deadly Viper,940584840,46,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:51:085,DamageDone,Strafing,945674044,6643,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:51:085,DamageDone,Strafing,945674044,7180,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:085,DamageDone,Strafing,945674044,7180,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:085,DamageDone,Strafing,945674044,7180,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:137,DamageDone,Decisive Sniping,964500434,99315,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:137,DamageDone,Decisive Sniping,964500434,99315,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:137,DamageDone,Decisive Sniping,964500434,38590,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:171,DamageDone,Storm Current,952531070,331,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:171,DamageDone,Deadly Viper,940584840,158,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:51:171,DamageDone,Storm Current,952531070,106,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:51:171,DamageDone,Storm Current,952531070,853,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:172,DamageDone,Storm Current,952531070,169,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:51:172,DamageDone,Deadly Viper,940584840,10,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:51:173,DamageDone,Storm Current,952531070,107,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:51:173,DamageDone,Storm Current,952531070,853,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:173,DamageDone,Storm Current,952531070,331,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:378,DamageDone,Mother Nature's Protest,963754730,328,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:379,DamageDone,Mother Nature's Protest,963754730,45,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:51:379,DamageDone,Mother Nature's Protest,963754730,848,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:379,DamageDone,Mother Nature's Protest,963754730,848,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:379,DamageDone,Mother Nature's Protest,963754730,848,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:465,DamageDone,Strafing,944953936,7192,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:465,DamageDone,Strafing,944953936,18403,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:465,DamageDone,Strafing,944953936,7192,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:465,DamageDone,Strafing,944953936,18403,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:552,DamageDone,Storm Current,952531070,854,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:552,DamageDone,Deadly Viper,940584840,830,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:51:552,DamageDone,Storm Current,952531070,854,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:552,DamageDone,Storm Current,952531070,82,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:51:552,DamageDone,Storm Current,952531070,854,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:778,DamageDone,Mother Nature's Protest,963754730,849,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:51:778,DamageDone,Mother Nature's Protest,963754730,73,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:51:778,DamageDone,Mother Nature's Protest,963754730,196,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:51:778,DamageDone,Mother Nature's Protest,963754730,471,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:51:778,DamageDone,Mother Nature's Protest,963754730,411,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:52:003,DamageDone,Storm Current,952531070,856,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:52:003,DamageDone,Deadly Viper,940584840,971,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:52:753,DamageDone,Mother Nature's Protest,963754730,327,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:52:789,DamageDone,Basic Shot,947551927,5045,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:52:896,DamageDone,Storm Current,952531070,65,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:52:896,DamageDone,Deadly Viper,940584840,2015,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:53:211,DamageDone,Mother Nature's Protest,963754730,979,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:53:211,DamageDone,Mother Nature's Protest,963754730,148,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:53:904,DamageDone,Deadly Viper,940584840,1009,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:183,DamageDone,Decisive Sniping,964631505,230287,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:183,DamageDone,Storm Current,952531070,931,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:183,DamageDone,Deadly Viper,940584840,310,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:218,DamageDone,Mother Nature's Protest,963754730,146,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:476,DamageDone,Basic Shot,947551927,4881,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:581,DamageDone,Roxie's Arrowhead,947532344,1143,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:581,DamageDone,Mother Nature's Protest,963754730,167,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:581,DamageDone,Mother Nature's Protest,963754730,55,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:581,DamageDone,Storm Current,952531070,295,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:54:581,DamageDone,Deadly Viper,940584840,407,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:600,DamageDone,Detonation Mark,953371309,92158,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:670,DamageDone,Basic Shot,947523317,1975,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:708,DamageDone,Storm Current,952531070,362,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:708,DamageDone,Deadly Viper,940584840,125,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:761,DamageDone,Quick Fire,964893236,11395,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:815,DamageDone,Storm Current,952531070,934,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:815,DamageDone,Deadly Viper,940584840,40,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:815,DamageDone,Quick Fire,964893236,25081,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:815,DamageDone,Storm Current,952531070,362,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:815,DamageDone,Deadly Viper,940584840,80,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:851,DamageDone,Quick Fire,964893236,29157,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:869,DamageDone,Storm Current,952531070,514,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:54:869,DamageDone,Deadly Viper,940584840,124,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:903,DamageDone,Quick Fire,964893236,25081,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:938,DamageDone,Storm Current,952531070,263,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:54:938,DamageDone,Deadly Viper,940584840,63,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:973,DamageDone,Quick Fire,964893236,29157,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:974,DamageDone,Mother Nature's Protest,963754730,360,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:974,DamageDone,Mother Nature's Protest,963754730,144,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:54:974,DamageDone,Storm Current,952531070,362,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:54:974,DamageDone,Deadly Viper,940584840,30,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:042,DamageDone,Storm Current,952531070,935,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:042,DamageDone,Deadly Viper,940584840,24,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:096,DamageDone,Mother Nature's Protest,963754730,180,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:096,DamageDone,Mother Nature's Protest,963754730,44,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:149,DamageDone,Decisive Sniping,964631505,119030,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:149,DamageDone,Decisive Sniping,964631505,37278,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:55:149,DamageDone,Decisive Sniping,964631505,46270,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:149,DamageDone,Storm Current,952531070,935,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:149,DamageDone,Deadly Viper,940584840,61,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:150,DamageDone,Storm Current,952531070,362,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:150,DamageDone,Storm Current,952531070,935,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:167,DamageDone,Mother Nature's Protest,963754730,360,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:168,DamageDone,Mother Nature's Protest,963754730,22,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:202,DamageDone,Mother Nature's Protest,963754730,927,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:202,DamageDone,Mother Nature's Protest,963754730,16,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:256,DamageDone,Decisive Sniping,964631505,119030,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:256,DamageDone,Decisive Sniping,964631505,60173,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:55:256,DamageDone,Decisive Sniping,964631505,119030,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:256,DamageDone,Mother Nature's Protest,963754730,300,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:256,DamageDone,Mother Nature's Protest,963754730,9,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:256,DamageDone,Storm Current,952531070,362,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:256,DamageDone,Deadly Viper,940584840,194,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:257,DamageDone,Storm Current,952531070,362,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:257,DamageDone,Storm Current,952531070,935,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:328,DamageDone,Mother Nature's Protest,963754730,927,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:328,DamageDone,Mother Nature's Protest,963754730,4,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:362,DamageDone,Decisive Sniping,964631505,56718,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:55:362,DamageDone,Decisive Sniping,964631505,119030,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:362,DamageDone,Decisive Sniping,964631505,119030,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:362,DamageDone,Mother Nature's Protest,963754730,67,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:362,DamageDone,Mother Nature's Protest,963754730,16,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:363,DamageDone,Storm Current,952531070,935,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:363,DamageDone,Deadly Viper,940584840,42,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:364,DamageDone,Storm Current,952531070,935,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:364,DamageDone,Storm Current,952531070,935,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:448,DamageDone,Mother Nature's Protest,963754730,927,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:468,DamageDone,Decisive Sniping,964631505,52342,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:55:468,DamageDone,Decisive Sniping,964631505,119030,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:468,DamageDone,Decisive Sniping,964631505,119030,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:486,DamageDone,Storm Current,952531070,362,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:486,DamageDone,Deadly Viper,940584840,210,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:487,DamageDone,Storm Current,952531070,362,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:487,DamageDone,Storm Current,952531070,228,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:55:664,DamageDone,Detonation Mark,953174691,15119,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:681,DamageDone,Detonation Mark,953174691,13029,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:699,DamageDone,Detonation Mark,953174691,4405,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:751,DamageDone,Storm Current,952531070,935,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:751,DamageDone,Deadly Viper,940584840,174,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:786,DamageDone,Storm Current,952531070,935,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:786,DamageDone,Deadly Viper,940584840,81,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:55:803,DamageDone,Storm Current,952531070,362,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:55:803,DamageDone,Deadly Viper,940584840,9,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:56:026,DamageDone,Ensnaring Arrow,963973967,10635,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:56:165,DamageDone,Storm Current,952531070,362,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:56:165,DamageDone,Deadly Viper,940584840,906,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:56:165,DamageDone,Mother Nature's Protest,963754730,927,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:56:165,DamageDone,Mother Nature's Protest,963754730,229,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:56:181,DamageDone,Mother Nature's Protest,963754730,142,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:56:181,DamageDone,Mother Nature's Protest,963754730,2,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:56:198,DamageDone,Mother Nature's Protest,963754730,360,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:56:198,DamageDone,Mother Nature's Protest,963754730,4,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:56:543,DamageDone,Mother Nature's Protest,963754730,98,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:57:147,DamageDone,Deadly Viper,940584840,2635,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:57:199,DamageDone,Mother Nature's Protest,963754730,356,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:57:995,DamageDone,Decisive Sniping,964500434,458744,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:57:996,DamageDone,Storm Current,952531070,284,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:57:996,DamageDone,Deadly Viper,940584840,1749,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:203,DamageDone,Mother Nature's Protest,963754730,287,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:236,DamageDone,Basic Shot,947551927,3784,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:377,DamageDone,Storm Current,952531070,806,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:377,DamageDone,Deadly Viper,940584840,111,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:410,DamageDone,Blade Storm,945710601,6025,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:410,DamageDone,Blade Storm,945710601,2540,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:463,DamageDone,Mother Nature's Protest,963754730,841,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:463,DamageDone,Mother Nature's Protest,963754730,71,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:463,DamageDone,Storm Current,952531070,328,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:463,DamageDone,Deadly Viper,940584840,232,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:464,DamageDone,Storm Current,952531070,328,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:496,DamageDone,Blade Storm,945710601,2540,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:497,DamageDone,Blade Storm,945710601,6338,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:566,DamageDone,Storm Current,952531070,328,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:566,DamageDone,Deadly Viper,940584840,157,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:566,DamageDone,Storm Current,952531070,413,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:58:617,DamageDone,Blade Storm,945710601,6338,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:617,DamageDone,Blade Storm,945710601,3398,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:58:653,DamageDone,Basic Shot,947523317,4115,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:653,DamageDone,Storm Current,952531070,847,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:653,DamageDone,Deadly Viper,940584840,28,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:653,DamageDone,Storm Current,952531070,847,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:705,DamageDone,Blade Storm,945710601,2540,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:705,DamageDone,Blade Storm,945710601,6338,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:791,DamageDone,Storm Current,952531070,847,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:791,DamageDone,Deadly Viper,940584840,156,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:791,DamageDone,Storm Current,952531070,328,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:791,DamageDone,Storm Current,952531070,847,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:824,DamageDone,Blade Storm,945710601,1013,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:824,DamageDone,Blade Storm,945710601,6338,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:824,DamageDone,Mother Nature's Protest,963754730,326,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:824,DamageDone,Mother Nature's Protest,963754730,47,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:824,DamageDone,Quick Fire,964696731,24626,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:876,DamageDone,Quick Fire,964696731,7027,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:58:877,DamageDone,Storm Current,952531070,847,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:877,DamageDone,Deadly Viper,940584840,115,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:877,DamageDone,Storm Current,952531070,66,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:911,DamageDone,Storm Current,952531070,328,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:911,DamageDone,Deadly Viper,940584840,14,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:911,DamageDone,Mother Nature's Protest,963754730,326,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:911,DamageDone,Mother Nature's Protest,963754730,6,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:912,DamageDone,Mother Nature's Protest,963754730,240,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:58:945,DamageDone,Quick Fire,964696731,24598,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:945,DamageDone,Decisive Sniping,964500434,102932,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:945,DamageDone,Decisive Sniping,964500434,39992,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:945,DamageDone,Decisive Sniping,964500434,102932,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:945,DamageDone,Storm Current,952531070,143,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:58:945,DamageDone,Deadly Viper,940584840,40,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:58:946,DamageDone,Storm Current,952531070,847,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:58:946,DamageDone,Storm Current,952531070,192,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:58:946,DamageDone,Storm Current,952531070,847,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:014,DamageDone,Storm Current,952531070,328,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:014,DamageDone,Deadly Viper,940584840,138,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:014,DamageDone,Mother Nature's Protest,963754730,385,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:59:014,DamageDone,Mother Nature's Protest,963754730,11,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:014,DamageDone,Mother Nature's Protest,963754730,112,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:031,DamageDone,Quick Fire,964696731,9584,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:031,DamageDone,Decisive Sniping,964500434,39992,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:031,DamageDone,Decisive Sniping,964500434,39992,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:031,DamageDone,Decisive Sniping,964500434,102932,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:067,DamageDone,Quick Fire,964696731,3858,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:59:068,DamageDone,Storm Current,952531070,328,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:068,DamageDone,Deadly Viper,940584840,40,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:068,DamageDone,Storm Current,952531070,328,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:068,DamageDone,Storm Current,952531070,328,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:118,DamageDone,Storm Current,952531070,217,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:59:118,DamageDone,Deadly Viper,940584840,105,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:119,DamageDone,Mother Nature's Protest,963754730,197,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:59:119,DamageDone,Mother Nature's Protest,963754730,35,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:119,DamageDone,Mother Nature's Protest,963754730,328,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:119,DamageDone,Roxie's Arrowhead,947532344,5493,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:135,DamageDone,Storm Current,952531070,847,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:136,DamageDone,Deadly Viper,940584840,69,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:153,DamageDone,Decisive Sniping,964500434,103798,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:153,DamageDone,Decisive Sniping,964500434,103798,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:153,DamageDone,Decisive Sniping,964500434,103798,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:187,DamageDone,Storm Current,952531070,331,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:187,DamageDone,Deadly Viper,940584840,27,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:188,DamageDone,Storm Current,952531070,331,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:188,DamageDone,Storm Current,952531070,331,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:221,DamageDone,Roxie's Arrowhead,947532344,2137,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:221,DamageDone,Mother Nature's Protest,963754730,364,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:59:221,DamageDone,Mother Nature's Protest,963754730,11,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:221,DamageDone,Mother Nature's Protest,963754730,329,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:222,DamageDone,Mother Nature's Protest,963754730,848,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:256,DamageDone,Decisive Sniping,964500434,40507,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:256,DamageDone,Decisive Sniping,964500434,8156,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:256,DamageDone,Decisive Sniping,964500434,104177,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:290,DamageDone,Storm Current,952531070,115,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:291,DamageDone,Deadly Viper,940584840,61,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:291,DamageDone,Storm Current,952531070,857,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:291,DamageDone,Storm Current,952531070,308,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:59:308,DamageDone,Mother Nature's Protest,963754730,338,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:59:308,DamageDone,Mother Nature's Protest,963754730,30,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:308,DamageDone,Mother Nature's Protest,963754730,850,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:326,DamageDone,Basic Shot,947457802,4105,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:341,DamageDone,Mother Nature's Protest,963754730,410,0,1,kNormalHit,Demo,Dragaryle
20260909-18:36:59:341,DamageDone,Mother Nature's Protest,963754730,2,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:380,DamageDone,Mother Nature's Protest,963754730,306,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:380,DamageDone,Mother Nature's Protest,963754730,5,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:487,DamageDone,Storm Current,952531070,859,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:488,DamageDone,Deadly Viper,940584840,96,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:488,DamageDone,Mother Nature's Protest,963754730,366,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:488,DamageDone,Mother Nature's Protest,963754730,8,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:556,DamageDone,Mother Nature's Protest,963754730,945,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:556,DamageDone,Mother Nature's Protest,963754730,13,0,0,kNormalHit,Demo,Dragaryle
20260909-18:36:59:591,DamageDone,Mother Nature's Protest,963754730,305,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:36:59:591,DamageDone,Mother Nature's Protest,963754730,17,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:007,DamageDone,Detonation Mark,953174691,2660,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:007,DamageDone,Mother Nature's Protest,963754730,162,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:007,DamageDone,Mother Nature's Protest,963754730,56,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:025,DamageDone,Detonation Mark,953174691,12498,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:025,DamageDone,Detonation Mark,953174691,200551,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:164,DamageDone,Storm Current,952531070,368,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:164,DamageDone,Deadly Viper,940584840,379,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:165,DamageDone,Storm Current,952531070,331,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:00:165,DamageDone,Deadly Viper,940584840,77,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:165,DamageDone,Storm Current,952531070,368,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:371,DamageDone,Strafing,945674044,18846,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:371,DamageDone,Strafing,945674044,18846,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:371,DamageDone,Strafing,945674044,9556,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:00:371,DamageDone,Strafing,945674044,18846,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:478,DamageDone,Storm Current,952531070,135,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:478,DamageDone,Deadly Viper,940584840,823,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:478,DamageDone,Storm Current,952531070,122,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:478,DamageDone,Storm Current,952531070,856,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:478,DamageDone,Storm Current,952531070,332,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:613,DamageDone,Mother Nature's Protest,963754730,328,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:613,DamageDone,Mother Nature's Protest,963754730,85,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:650,DamageDone,Mother Nature's Protest,963754730,706,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:651,DamageDone,Mother Nature's Protest,963754730,4,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:651,DamageDone,Mother Nature's Protest,963754730,56,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:709,DamageDone,Strafing,944953936,7404,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:709,DamageDone,Strafing,944953936,18871,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:709,DamageDone,Strafing,944953936,18871,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:709,DamageDone,Strafing,944953936,18871,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:743,DamageDone,Strafing,944953936,10437,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:848,DamageDone,Storm Current,952531070,337,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:00:848,DamageDone,Deadly Viper,940584840,814,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:848,DamageDone,Storm Current,952531070,857,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:848,DamageDone,Storm Current,952531070,332,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:848,DamageDone,Storm Current,952531070,857,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:848,DamageDone,Storm Current,952531070,857,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:848,DamageDone,Deadly Viper,940584840,33,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:985,DamageDone,Mother Nature's Protest,963754730,126,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:985,DamageDone,Mother Nature's Protest,963754730,90,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:00:985,DamageDone,Mother Nature's Protest,963754730,849,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:985,DamageDone,Mother Nature's Protest,963754730,329,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:00:985,DamageDone,Mother Nature's Protest,963754730,136,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:01:347,DamageDone,Mother Nature's Protest,963754730,849,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:01:347,DamageDone,Mother Nature's Protest,963754730,47,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:01:347,DamageDone,Mother Nature's Protest,963754730,849,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:01:347,DamageDone,Mother Nature's Protest,963754730,849,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:01:347,DamageDone,Roxie's Arrowhead,947532344,3321,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:01:347,DamageDone,Mother Nature's Protest,963754730,849,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:01:864,DamageDone,Deadly Viper,940584840,1232,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:02:348,DamageDone,Mother Nature's Protest,963754730,127,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:02:864,DamageDone,Deadly Viper,940584840,1231,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:03:364,DamageDone,Mother Nature's Protest,963754730,127,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:03:669,DamageDone,Detonation Mark,953174691,107049,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:03:808,DamageDone,Decisive Sniping,964500434,143253,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:03:808,DamageDone,Storm Current,952531070,309,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:03:808,DamageDone,Deadly Viper,940584840,1135,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:03:808,DamageDone,Storm Current,952531070,314,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:04:363,DamageDone,Mother Nature's Protest,963754730,127,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:415,DamageDone,Mother Nature's Protest,963754730,8,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:431,DamageDone,Basic Shot,947523317,1076,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:04:432,DamageDone,Mother Nature's Protest,963754730,240,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:04:432,DamageDone,Mother Nature's Protest,963754730,2,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:432,DamageDone,Mother Nature's Protest,963754730,105,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:04:537,DamageDone,Storm Current,952531070,76,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:537,DamageDone,Deadly Viper,940584840,568,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:571,DamageDone,Quick Fire,964696731,9376,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:04:608,DamageDone,Quick Fire,964696731,5116,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:04:640,DamageDone,Storm Current,952531070,133,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:640,DamageDone,Deadly Viper,940584840,98,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:677,DamageDone,Quick Fire,964696731,20025,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:693,DamageDone,Storm Current,952531070,251,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:693,DamageDone,Deadly Viper,940584840,28,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:745,DamageDone,Decisive Sniping,964500434,12572,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:745,DamageDone,Decisive Sniping,964500434,59416,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:745,DamageDone,Decisive Sniping,964500434,59416,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:745,DamageDone,Storm Current,952531070,251,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:745,DamageDone,Deadly Viper,940584840,38,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:762,DamageDone,Storm Current,952531070,646,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:762,DamageDone,Deadly Viper,940584840,23,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:763,DamageDone,Storm Current,952531070,251,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:763,DamageDone,Storm Current,952531070,251,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:779,DamageDone,Quick Fire,964696731,20025,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:851,DamageDone,Quick Fire,964696731,15213,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:869,DamageDone,Storm Current,952531070,646,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:869,DamageDone,Deadly Viper,940584840,67,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:869,DamageDone,Decisive Sniping,964500434,23099,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:869,DamageDone,Decisive Sniping,964500434,59319,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:869,DamageDone,Decisive Sniping,964500434,29201,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:04:886,DamageDone,Storm Current,952531070,645,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:886,DamageDone,Deadly Viper,940584840,9,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:886,DamageDone,Storm Current,952531070,250,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:886,DamageDone,Storm Current,952531070,250,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:920,DamageDone,Storm Current,952531070,271,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:04:920,DamageDone,Deadly Viper,940584840,49,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:04:971,DamageDone,Decisive Sniping,964500434,27127,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:04:971,DamageDone,Decisive Sniping,964500434,23048,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:04:971,DamageDone,Decisive Sniping,964500434,59185,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:006,DamageDone,Storm Current,952531070,250,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:006,DamageDone,Deadly Viper,940584840,48,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:006,DamageDone,Storm Current,952531070,644,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:006,DamageDone,Storm Current,952531070,203,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:05:077,DamageDone,Basic Shot,947457802,1340,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:127,DamageDone,Mother Nature's Protest,963754730,636,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:127,DamageDone,Mother Nature's Protest,963754730,35,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:196,DamageDone,Storm Current,952531070,642,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:196,DamageDone,Deadly Viper,940584840,297,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:213,DamageDone,Mother Nature's Protest,963754730,635,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:213,DamageDone,Mother Nature's Protest,963754730,7,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:251,DamageDone,Mother Nature's Protest,963754730,205,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:251,DamageDone,Mother Nature's Protest,963754730,7,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:318,DamageDone,Mother Nature's Protest,963754730,634,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:318,DamageDone,Mother Nature's Protest,963754730,8,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:404,DamageDone,Mother Nature's Protest,963754730,371,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:05:404,DamageDone,Mother Nature's Protest,963754730,22,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:439,DamageDone,Mother Nature's Protest,963754730,204,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:439,DamageDone,Mother Nature's Protest,963754730,7,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:508,DamageDone,Basic Shot,947551927,3216,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:649,DamageDone,Storm Current,952531070,152,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:649,DamageDone,Deadly Viper,940584840,691,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:700,DamageDone,Mother Nature's Protest,963754730,629,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:700,DamageDone,Mother Nature's Protest,963754730,16,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:735,DamageDone,Detonation Mark,953174691,9088,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:735,DamageDone,Basic Shot,947523317,1323,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:769,DamageDone,Detonation Mark,953174691,811,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:803,DamageDone,Detonation Mark,953174691,273,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:876,DamageDone,Storm Current,952531070,232,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:876,DamageDone,Deadly Viper,940584840,236,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:876,DamageDone,Storm Current,952531070,599,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:893,DamageDone,Storm Current,952531070,232,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:893,DamageDone,Deadly Viper,940584840,45,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:05:945,DamageDone,Storm Current,952531070,232,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:05:945,DamageDone,Deadly Viper,940584840,5,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:06:014,DamageDone,Mother Nature's Protest,963754730,594,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:014,DamageDone,Mother Nature's Protest,963754730,83,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:06:082,DamageDone,Strafing,945674044,12330,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:083,DamageDone,Strafing,945674044,4865,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:083,DamageDone,Strafing,945674044,3204,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:06:083,DamageDone,Strafing,945674044,12330,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:221,DamageDone,Storm Current,952531070,599,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:221,DamageDone,Deadly Viper,940584840,461,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:06:221,DamageDone,Storm Current,952531070,232,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:221,DamageDone,Storm Current,952531070,83,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:06:221,DamageDone,Storm Current,952531070,599,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:256,DamageDone,Mother Nature's Protest,963754730,595,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:256,DamageDone,Mother Nature's Protest,963754730,53,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:06:256,DamageDone,Mother Nature's Protest,963754730,595,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:290,DamageDone,Mother Nature's Protest,963754730,191,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:290,DamageDone,Mother Nature's Protest,963754730,7,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:06:290,DamageDone,Mother Nature's Protest,963754730,230,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:290,DamageDone,Mother Nature's Protest,963754730,1,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:06:533,DamageDone,Strafing,944953936,12302,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:533,DamageDone,Strafing,944953936,12302,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:533,DamageDone,Strafing,944953936,1515,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:06:533,DamageDone,Strafing,944953936,2310,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:06:654,DamageDone,Mother Nature's Protest,963754730,591,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:654,DamageDone,Mother Nature's Protest,963754730,71,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:06:654,DamageDone,Mother Nature's Protest,963754730,229,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:654,DamageDone,Mother Nature's Protest,963754730,591,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:654,DamageDone,Mother Nature's Protest,963754730,591,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:654,DamageDone,Storm Current,952531070,127,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:06:654,DamageDone,Deadly Viper,940584840,232,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:06:654,DamageDone,Storm Current,952531070,231,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:654,DamageDone,Storm Current,952531070,231,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:654,DamageDone,Storm Current,952531070,597,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:879,DamageDone,Strafing,944299709,5946,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:06:879,DamageDone,Strafing,944299709,3117,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:06:879,DamageDone,Strafing,944299709,13035,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:879,DamageDone,Strafing,944299709,13035,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:946,DamageDone,Mother Nature's Protest,963754730,629,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:946,DamageDone,Mother Nature's Protest,963754730,30,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:06:946,DamageDone,Mother Nature's Protest,963754730,261,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:06:946,DamageDone,Mother Nature's Protest,963754730,629,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:946,DamageDone,Roxie's Arrowhead,947532344,1760,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:06:947,DamageDone,Mother Nature's Protest,963754730,629,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:981,DamageDone,Storm Current,952531070,246,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:981,DamageDone,Deadly Viper,940584840,138,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:06:981,DamageDone,Storm Current,952531070,366,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:06:981,DamageDone,Storm Current,952531070,634,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:06:981,DamageDone,Storm Current,952531070,246,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:07:293,DamageDone,Ensnaring Arrow,963973967,6311,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:07:326,DamageDone,Mother Nature's Protest,963754730,633,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:07:326,DamageDone,Mother Nature's Protest,963754730,87,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:07:326,DamageDone,Mother Nature's Protest,963754730,155,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:07:326,DamageDone,Roxie's Arrowhead,947532344,2434,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:07:326,DamageDone,Mother Nature's Protest,963754730,246,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:07:326,DamageDone,Mother Nature's Protest,963754730,302,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:07:378,DamageDone,Storm Current,952531070,637,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:07:378,DamageDone,Deadly Viper,940584840,159,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:07:777,DamageDone,Mother Nature's Protest,963754730,806,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:07:777,DamageDone,Mother Nature's Protest,963754730,114,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:07:915,DamageDone,Quick Fire,965155724,8661,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:07:984,DamageDone,Storm Current,952531070,296,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:07:984,DamageDone,Quick Fire,965155724,3179,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:08:036,DamageDone,Quick Fire,965155724,2211,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:08:087,DamageDone,Storm Current,952531070,113,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:08:121,DamageDone,Quick Fire,965155724,7725,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:08:139,DamageDone,Storm Current,952531070,299,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:08:225,DamageDone,Storm Current,952531070,298,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:08:311,DamageDone,Mother Nature's Protest,963754730,227,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:08:311,DamageDone,Mother Nature's Protest,963754730,86,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:08:404,DamageDone,Deadly Viper,940584840,686,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:08:421,DamageDone,Mother Nature's Protest,963754730,678,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:08:421,DamageDone,Mother Nature's Protest,963754730,16,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:08:454,DamageDone,Mother Nature's Protest,963754730,565,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:08:454,DamageDone,Mother Nature's Protest,963754730,8,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:08:524,DamageDone,Mother Nature's Protest,963754730,288,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:08:524,DamageDone,Mother Nature's Protest,963754730,5,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:09:371,DamageDone,Deadly Viper,940584840,633,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:09:423,DamageDone,Detonation Mark,953174691,99615,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:09:544,DamageDone,Mother Nature's Protest,963754730,60,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:09:544,DamageDone,Storm Current,952531070,51,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:09:630,DamageDone,Decisive Sniping,964631505,145349,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:09:647,DamageDone,Storm Current,952531070,155,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:09:803,DamageDone,Mother Nature's Protest,963754730,566,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:09:925,DamageDone,Mother Nature's Protest,963754730,263,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:09:925,DamageDone,Mother Nature's Protest,963754730,25,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:09:925,DamageDone,Roxie's Arrowhead,947532344,6646,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:035,DamageDone,Basic Shot,947551927,3347,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:035,DamageDone,Blade Storm,945408027,2040,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:10:106,DamageDone,Storm Current,952531070,337,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:10:106,DamageDone,Storm Current,952531070,73,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:121,DamageDone,Blade Storm,945408027,2095,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:209,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:243,DamageDone,Blade Storm,945408027,1771,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:10:312,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:329,DamageDone,Blade Storm,945408027,5192,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:346,DamageDone,Basic Shot,947523317,3518,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:381,DamageDone,Deadly Viper,940584840,643,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:381,DamageDone,Mother Nature's Protest,963754730,716,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:381,DamageDone,Mother Nature's Protest,963754730,70,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:416,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:416,DamageDone,Mother Nature's Protest,963754730,278,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:416,DamageDone,Mother Nature's Protest,963754730,4,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:416,DamageDone,Blade Storm,945408027,740,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:467,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:502,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:519,DamageDone,Mother Nature's Protest,963754730,716,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:519,DamageDone,Mother Nature's Protest,963754730,17,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:536,DamageDone,Storm Current,952531070,114,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:571,DamageDone,Decisive Sniping,964631505,30722,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:571,DamageDone,Decisive Sniping,964631505,78961,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:571,DamageDone,Decisive Sniping,964631505,78961,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:606,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:606,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:606,DamageDone,Storm Current,952531070,117,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:606,DamageDone,Mother Nature's Protest,963754730,386,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:10:606,DamageDone,Mother Nature's Protest,963754730,10,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:675,DamageDone,Decisive Sniping,964631505,78961,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:675,DamageDone,Decisive Sniping,964631505,30722,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:675,DamageDone,Decisive Sniping,964631505,78961,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:727,DamageDone,Storm Current,952531070,82,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:727,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:727,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:728,DamageDone,Mother Nature's Protest,963754730,226,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:10:728,DamageDone,Mother Nature's Protest,963754730,17,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:760,DamageDone,Mother Nature's Protest,963754730,716,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:795,DamageDone,Mother Nature's Protest,963754730,278,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:795,DamageDone,Mother Nature's Protest,963754730,8,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:795,DamageDone,Decisive Sniping,964631505,78961,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:795,DamageDone,Decisive Sniping,964631505,78961,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:795,DamageDone,Decisive Sniping,964631505,12880,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:811,DamageDone,Storm Current,952531070,93,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:10:812,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:812,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:933,DamageDone,Decisive Sniping,964631505,30722,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:933,DamageDone,Decisive Sniping,964631505,78961,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:933,DamageDone,Decisive Sniping,964631505,30722,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:933,DamageDone,Storm Current,952531070,313,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:10:933,DamageDone,Storm Current,952531070,279,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:10:933,DamageDone,Storm Current,952531070,420,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:11:243,DamageDone,Quick Fire,964762401,4710,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:11:243,DamageDone,Quick Fire,964762401,8897,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:11:295,DamageDone,Quick Fire,964762401,6684,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:11:330,DamageDone,Storm Current,952531070,279,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:11:330,DamageDone,Storm Current,952531070,279,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:11:381,DamageDone,Quick Fire,964762401,19754,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:11:381,DamageDone,Deadly Viper,940584840,676,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:11:381,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:11:450,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:11:501,DamageDone,Quick Fire,964762401,19754,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:11:605,DamageDone,Storm Current,952531070,286,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:11:622,DamageDone,Mother Nature's Protest,963754730,716,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:11:622,DamageDone,Mother Nature's Protest,963754730,135,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:11:709,DamageDone,Mother Nature's Protest,963754730,596,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:11:709,DamageDone,Mother Nature's Protest,963754730,6,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:11:709,DamageDone,Detonation Mark,953371309,10349,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:11:744,DamageDone,Mother Nature's Protest,963754730,716,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:11:744,DamageDone,Mother Nature's Protest,963754730,14,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:11:830,DamageDone,Storm Current,952531070,152,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:11:916,DamageDone,Mother Nature's Protest,963754730,716,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:11:916,DamageDone,Mother Nature's Protest,963754730,43,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:12:105,DamageDone,Strafing,945674044,15000,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:105,DamageDone,Strafing,945674044,2467,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:12:105,DamageDone,Strafing,945674044,5902,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:105,DamageDone,Strafing,945674044,15000,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:123,DamageDone,Mother Nature's Protest,963754730,716,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:123,DamageDone,Mother Nature's Protest,963754730,60,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:12:175,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:175,DamageDone,Storm Current,952531070,722,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:175,DamageDone,Storm Current,952531070,280,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:175,DamageDone,Storm Current,952531070,280,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:364,DamageDone,Deadly Viper,940584840,678,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:12:485,DamageDone,Strafing,944953936,15357,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:485,DamageDone,Strafing,944953936,6041,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:485,DamageDone,Strafing,944953936,6041,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:485,DamageDone,Strafing,944953936,6041,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:485,DamageDone,Roxie's Arrowhead,947532344,7353,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:485,DamageDone,Mother Nature's Protest,963754730,716,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:485,DamageDone,Mother Nature's Protest,963754730,94,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:12:485,DamageDone,Mother Nature's Protest,963754730,716,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:486,DamageDone,Mother Nature's Protest,963754730,376,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:12:486,DamageDone,Mother Nature's Protest,963754730,278,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:555,DamageDone,Storm Current,952531070,72,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:12:555,DamageDone,Storm Current,952531070,280,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:555,DamageDone,Storm Current,952531070,723,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:555,DamageDone,Storm Current,952531070,723,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:814,DamageDone,Strafing,944299709,15373,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:814,DamageDone,Strafing,944299709,15373,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:814,DamageDone,Strafing,944299709,6047,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:814,DamageDone,Strafing,944299709,15373,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:848,DamageDone,Roxie's Arrowhead,947532344,7359,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:848,DamageDone,Mother Nature's Protest,963754730,717,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:848,DamageDone,Mother Nature's Protest,963754730,40,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:12:848,DamageDone,Mother Nature's Protest,963754730,259,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:12:848,DamageDone,Roxie's Arrowhead,947532344,2856,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:848,DamageDone,Mother Nature's Protest,963754730,279,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:849,DamageDone,Mother Nature's Protest,963754730,279,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:917,DamageDone,Storm Current,952531070,280,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:917,DamageDone,Storm Current,952531070,723,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:917,DamageDone,Storm Current,952531070,280,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:12:917,DamageDone,Storm Current,952531070,723,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:13:210,DamageDone,Mother Nature's Protest,963754730,859,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:13:210,DamageDone,Mother Nature's Protest,963754730,99,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:13:210,DamageDone,Mother Nature's Protest,963754730,336,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:13:210,DamageDone,Mother Nature's Protest,963754730,859,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:13:210,DamageDone,Mother Nature's Protest,963754730,859,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:13:381,DamageDone,Deadly Viper,940584840,676,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:13:848,DamageDone,Basic Shot,947551927,1810,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:13:934,DamageDone,Storm Current,952531070,881,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:14:037,DamageDone,Ensnaring Arrow,963973967,1543,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:14:141,DamageDone,Storm Current,952531070,881,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:14:192,DamageDone,Mother Nature's Protest,963754730,331,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:14:348,DamageDone,Basic Shot,947523317,4449,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:14:399,DamageDone,Deadly Viper,940584840,688,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:14:434,DamageDone,Mother Nature's Protest,963754730,302,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:14:434,DamageDone,Mother Nature's Protest,963754730,72,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:14:468,DamageDone,Storm Current,952531070,306,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:14:623,DamageDone,Mother Nature's Protest,963754730,104,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:14:623,DamageDone,Mother Nature's Protest,963754730,56,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:14:813,DamageDone,Deadly Viper,940584840,285,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:14:847,DamageDone,Mother Nature's Protest,963754730,777,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:14:847,DamageDone,Mother Nature's Protest,963754730,75,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:14:882,DamageDone,Deadly Viper,940584840,43,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:15:537,DamageDone,Detonation Mark,953371309,57486,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:15:641,DamageDone,Decisive Sniping,964631505,444355,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:15:676,DamageDone,Storm Current,952531070,301,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:15:676,DamageDone,Storm Current,952531070,82,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:15:900,DamageDone,Mother Nature's Protest,963754730,299,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:15:951,DamageDone,Mother Nature's Protest,963754730,283,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:15:951,DamageDone,Mother Nature's Protest,963754730,22,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:15:951,DamageDone,Mother Nature's Protest,963754730,283,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:15:951,DamageDone,Basic Shot,947551927,3936,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:055,DamageDone,Storm Current,952531070,356,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:16:141,DamageDone,Basic Shot,947523317,1608,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:261,DamageDone,Storm Current,952531070,89,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:16:331,DamageDone,Mother Nature's Protest,963754730,728,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:331,DamageDone,Mother Nature's Protest,963754730,109,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:16:538,DamageDone,Mother Nature's Protest,963754730,284,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:590,DamageDone,Basic Shot,947457802,1608,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:676,DamageDone,Storm Current,952531070,738,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:728,DamageDone,Decisive Sniping,964631505,84556,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:728,DamageDone,Decisive Sniping,964631505,84556,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:728,DamageDone,Decisive Sniping,964631505,84556,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:728,DamageDone,Blade Storm,945710601,5533,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:728,DamageDone,Blade Storm,945710601,5533,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:728,DamageDone,Storm Current,952531070,738,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:728,DamageDone,Storm Current,952531070,286,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:728,DamageDone,Storm Current,952531070,127,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:16:797,DamageDone,Storm Current,952531070,286,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:798,DamageDone,Storm Current,952531070,286,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:814,DamageDone,Decisive Sniping,964631505,84645,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:814,DamageDone,Decisive Sniping,964631505,84645,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:814,DamageDone,Decisive Sniping,964631505,7187,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:16:831,DamageDone,Blade Storm,945710601,5533,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:831,DamageDone,Blade Storm,945710601,2228,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:831,DamageDone,Storm Current,952531070,287,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:831,DamageDone,Storm Current,952531070,739,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:831,DamageDone,Storm Current,952531070,141,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:16:918,DamageDone,Storm Current,952531070,739,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:918,DamageDone,Storm Current,952531070,245,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:16:918,DamageDone,Decisive Sniping,964631505,18086,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:16:918,DamageDone,Decisive Sniping,964631505,32934,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:918,DamageDone,Decisive Sniping,964631505,25437,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:16:918,DamageDone,Blade Storm,945710601,2228,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:918,DamageDone,Blade Storm,945710601,2807,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:16:951,DamageDone,Storm Current,952531070,287,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:952,DamageDone,Storm Current,952531070,287,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:16:952,DamageDone,Storm Current,952531070,739,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:039,DamageDone,Mother Nature's Protest,963754730,284,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:039,DamageDone,Mother Nature's Protest,963754730,74,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:17:039,DamageDone,Storm Current,952531070,739,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:039,DamageDone,Storm Current,952531070,739,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:039,DamageDone,Blade Storm,945710601,5533,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:039,DamageDone,Blade Storm,945710601,5533,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:107,DamageDone,Storm Current,952531070,287,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:107,DamageDone,Storm Current,952531070,133,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:17:124,DamageDone,Blade Storm,945710601,5533,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:124,DamageDone,Blade Storm,945710601,5533,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:141,DamageDone,Mother Nature's Protest,963754730,733,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:141,DamageDone,Mother Nature's Protest,963754730,35,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:17:141,DamageDone,Mother Nature's Protest,963754730,733,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:211,DamageDone,Storm Current,952531070,113,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:17:211,DamageDone,Storm Current,952531070,286,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:211,DamageDone,Quick Fire,964762401,7939,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:245,DamageDone,Mother Nature's Protest,963754730,147,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:17:245,DamageDone,Mother Nature's Protest,963754730,31,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:17:245,DamageDone,Mother Nature's Protest,963754730,122,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:17:261,DamageDone,Quick Fire,964762401,6830,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:314,DamageDone,Storm Current,952531070,148,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:17:314,DamageDone,Quick Fire,964762401,20249,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:400,DamageDone,Storm Current,952531070,769,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:401,DamageDone,Mother Nature's Protest,963754730,339,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:17:401,DamageDone,Mother Nature's Protest,963754730,44,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:17:401,DamageDone,Mother Nature's Protest,963754730,733,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:434,DamageDone,Quick Fire,964762401,20248,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:451,DamageDone,Mother Nature's Protest,963754730,236,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:17:451,DamageDone,Mother Nature's Protest,963754730,5,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:17:451,DamageDone,Mother Nature's Protest,963754730,733,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:675,DamageDone,Mother Nature's Protest,963754730,740,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:675,DamageDone,Mother Nature's Protest,963754730,57,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:17:676,DamageDone,Roxie's Arrowhead,947532344,4508,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:17:676,DamageDone,Mother Nature's Protest,963754730,740,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:18:244,DamageDone,Mother Nature's Protest,963754730,856,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:18:296,DamageDone,Mother Nature's Protest,963754730,335,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:18:296,DamageDone,Mother Nature's Protest,963754730,70,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:19:314,DamageDone,Mother Nature's Protest,963754730,265,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:20:089,DamageDone,Strafing,944953936,5560,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:089,DamageDone,Strafing,944953936,6423,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:20:089,DamageDone,Strafing,944953936,5560,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:089,DamageDone,Strafing,944953936,14120,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:195,DamageDone,Storm Current,952531070,103,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:20:195,DamageDone,Storm Current,952531070,695,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:195,DamageDone,Storm Current,952531070,269,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:195,DamageDone,Storm Current,952531070,269,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:296,DamageDone,Mother Nature's Protest,963754730,266,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:20:435,DamageDone,Strafing,944299709,6779,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:435,DamageDone,Strafing,944299709,17261,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:435,DamageDone,Strafing,944299709,17261,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:435,DamageDone,Strafing,944299709,4098,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:20:470,DamageDone,Strafing,944299709,9533,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:556,DamageDone,Storm Current,952531070,111,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:20:556,DamageDone,Storm Current,952531070,330,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:556,DamageDone,Storm Current,952531070,330,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:556,DamageDone,Storm Current,952531070,852,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:591,DamageDone,Storm Current,952531070,851,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:780,DamageDone,Basic Shot,947523317,1926,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:20:797,DamageDone,Mother Nature's Protest,963754730,840,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:797,DamageDone,Mother Nature's Protest,963754730,133,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:20:797,DamageDone,Roxie's Arrowhead,947532344,3651,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:20:797,DamageDone,Mother Nature's Protest,963754730,840,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:797,DamageDone,Mother Nature's Protest,963754730,454,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:20:797,DamageDone,Mother Nature's Protest,963754730,840,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:797,DamageDone,Roxie's Arrowhead,947532344,8219,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:20:901,DamageDone,Storm Current,952531070,848,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:21:073,DamageDone,Mother Nature's Protest,963754730,839,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:21:073,DamageDone,Mother Nature's Protest,963754730,53,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:21:073,DamageDone,Roxie's Arrowhead,947532344,3080,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:21:073,DamageDone,Mother Nature's Protest,963754730,839,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:21:073,DamageDone,Mother Nature's Protest,963754730,229,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:21:073,DamageDone,Mother Nature's Protest,963754730,325,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:21:161,DamageDone,Ensnaring Arrow,963973967,8046,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:21:263,DamageDone,Storm Current,952531070,181,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:21:349,DamageDone,Mother Nature's Protest,963754730,839,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:21:349,DamageDone,Mother Nature's Protest,963754730,85,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:21:711,DamageDone,Mother Nature's Protest,963754730,839,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:21:711,DamageDone,Mother Nature's Protest,963754730,47,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:21:711,DamageDone,Roxie's Arrowhead,947532344,2765,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:22:731,DamageDone,Mother Nature's Protest,963754730,189,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:23:509,DamageDone,Decisive Sniping,964500434,408691,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:23:509,DamageDone,Storm Current,952531070,789,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:23:733,DamageDone,Mother Nature's Protest,963754730,189,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:23:939,DamageDone,Basic Shot,947551927,1406,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:24:080,DamageDone,Storm Current,952531070,311,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:080,DamageDone,Detonation Mark,953371309,4249,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:116,DamageDone,Mother Nature's Protest,963754730,308,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:116,DamageDone,Mother Nature's Protest,963754730,68,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:24:168,DamageDone,Storm Current,952531070,802,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:425,DamageDone,Basic Shot,947523317,3797,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:459,DamageDone,Blade Storm,945710601,887,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:24:459,DamageDone,Blade Storm,945710601,5800,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:511,DamageDone,Storm Current,952531070,330,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:511,DamageDone,Storm Current,952531070,330,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:547,DamageDone,Storm Current,952531070,445,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:24:547,DamageDone,Blade Storm,945710601,2301,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:547,DamageDone,Blade Storm,945710601,3303,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:24:633,DamageDone,Storm Current,952531070,853,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:633,DamageDone,Storm Current,952531070,853,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:633,DamageDone,Decisive Sniping,964500434,49246,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:24:633,DamageDone,Decisive Sniping,964500434,88841,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:633,DamageDone,Decisive Sniping,964500434,46362,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:24:633,DamageDone,Blade Storm,945710601,2292,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:24:633,DamageDone,Blade Storm,945710601,2555,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:24:633,DamageDone,Mother Nature's Protest,963754730,181,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:24:633,DamageDone,Mother Nature's Protest,963754730,162,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:24:634,DamageDone,Storm Current,952531070,331,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:634,DamageDone,Storm Current,952531070,73,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:24:634,DamageDone,Storm Current,952531070,853,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:719,DamageDone,Storm Current,952531070,152,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:24:719,DamageDone,Storm Current,952531070,158,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:24:787,DamageDone,Blade Storm,945710601,5800,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:787,DamageDone,Blade Storm,945710601,1942,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:24:787,DamageDone,Quick Fire,964762401,21643,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:787,DamageDone,Mother Nature's Protest,963754730,852,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:787,DamageDone,Mother Nature's Protest,963754730,35,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:24:806,DamageDone,Quick Fire,964762401,18611,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:806,DamageDone,Storm Current,952531070,333,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:806,DamageDone,Storm Current,952531070,333,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:858,DamageDone,Blade Storm,945710601,2790,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:24:858,DamageDone,Blade Storm,945710601,5800,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:858,DamageDone,Storm Current,952531070,859,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:859,DamageDone,Quick Fire,964762401,8449,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:909,DamageDone,Storm Current,952531070,860,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:909,DamageDone,Storm Current,952531070,863,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:909,DamageDone,Storm Current,952531070,863,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:959,DamageDone,Storm Current,952531070,864,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:24:960,DamageDone,Quick Fire,964762401,21649,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:081,DamageDone,Storm Current,952531070,336,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:134,DamageDone,Mother Nature's Protest,963754730,961,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:134,DamageDone,Mother Nature's Protest,963754730,123,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:25:134,DamageDone,Mother Nature's Protest,963754730,372,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:134,DamageDone,Mother Nature's Protest,963754730,188,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:25:134,DamageDone,Mother Nature's Protest,963754730,2,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:25:235,DamageDone,Mother Nature's Protest,963754730,372,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:235,DamageDone,Mother Nature's Protest,963754730,5,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:25:235,DamageDone,Mother Nature's Protest,963754730,252,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:25:339,DamageDone,Mother Nature's Protest,963754730,958,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:339,DamageDone,Mother Nature's Protest,963754730,13,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:25:339,DamageDone,Mother Nature's Protest,963754730,958,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:459,DamageDone,Mother Nature's Protest,963754730,956,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:460,DamageDone,Mother Nature's Protest,963754730,23,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:25:460,DamageDone,Mother Nature's Protest,963754730,231,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:25:495,DamageDone,Mother Nature's Protest,963754730,955,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:495,DamageDone,Mother Nature's Protest,963754730,17,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:25:564,DamageDone,Mother Nature's Protest,963754730,308,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:598,DamageDone,Mother Nature's Protest,963754730,370,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:598,DamageDone,Mother Nature's Protest,963754730,17,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:25:598,DamageDone,Mother Nature's Protest,963754730,953,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:649,DamageDone,Mother Nature's Protest,963754730,370,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:650,DamageDone,Mother Nature's Protest,963754730,6,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:25:770,DamageDone,Mother Nature's Protest,963754730,130,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:25:770,DamageDone,Mother Nature's Protest,963754730,51,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:25:787,DamageDone,Basic Shot,947523317,1856,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:855,DamageDone,Quick Fire,964762401,9642,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:926,DamageDone,Storm Current,952531070,372,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:926,DamageDone,Quick Fire,964762401,21175,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:943,DamageDone,Storm Current,952531070,959,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:25:976,DamageDone,Quick Fire,964762401,24591,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:26:011,DamageDone,Storm Current,952531070,958,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:26:046,DamageDone,Storm Current,952531070,372,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:26:080,DamageDone,Quick Fire,964762401,9608,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:26:149,DamageDone,Storm Current,952531070,331,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:26:476,DamageDone,Mother Nature's Protest,963754730,268,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:26:476,DamageDone,Mother Nature's Protest,963754730,51,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:26:511,DamageDone,Mother Nature's Protest,963754730,689,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:26:511,DamageDone,Mother Nature's Protest,963754730,3,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:26:563,DamageDone,Mother Nature's Protest,963754730,574,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:26:563,DamageDone,Mother Nature's Protest,963754730,8,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:26:564,DamageDone,Basic Shot,947457802,3819,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:26:580,DamageDone,Mother Nature's Protest,963754730,689,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:26:580,DamageDone,Mother Nature's Protest,963754730,10,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:26:666,DamageDone,Storm Current,952531070,695,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:26:667,DamageDone,Mother Nature's Protest,963754730,268,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:249,DamageDone,Mother Nature's Protest,963754730,196,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:27:249,DamageDone,Mother Nature's Protest,963754730,161,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:27:249,DamageDone,Decisive Sniping,964500434,204460,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:249,DamageDone,Storm Current,952531070,771,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:440,DamageDone,Detonation Mark,953371309,81505,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:27:544,DamageDone,Storm Current,952531070,772,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:666,DamageDone,Quick Fire,964762401,19794,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:666,DamageDone,Roxie's Arrowhead,947532344,7153,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:666,DamageDone,Mother Nature's Protest,963754730,766,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:666,DamageDone,Mother Nature's Protest,963754730,47,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:27:681,DamageDone,Quick Fire,964762401,17076,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:751,DamageDone,Storm Current,952531070,61,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:27:751,DamageDone,Quick Fire,964762401,7773,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:784,DamageDone,Storm Current,952531070,300,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:836,DamageDone,Storm Current,952531070,773,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:871,DamageDone,Quick Fire,964762401,20817,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:974,DamageDone,Mother Nature's Protest,963754730,766,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:974,DamageDone,Mother Nature's Protest,963754730,87,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:27:975,DamageDone,Roxie's Arrowhead,947532344,1784,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:27:975,DamageDone,Storm Current,952531070,773,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:095,DamageDone,Strafing,945674044,6196,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:095,DamageDone,Strafing,945674044,15759,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:095,DamageDone,Strafing,945674044,6196,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:095,DamageDone,Strafing,945674044,15759,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:131,DamageDone,Strafing,945674044,22233,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:146,DamageDone,Mother Nature's Protest,963754730,297,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:146,DamageDone,Mother Nature's Protest,963754730,55,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:28:198,DamageDone,Mother Nature's Protest,963754730,639,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:198,DamageDone,Mother Nature's Protest,963754730,13,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:28:216,DamageDone,Storm Current,952531070,300,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:216,DamageDone,Storm Current,952531070,258,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:28:216,DamageDone,Storm Current,952531070,87,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:28:216,DamageDone,Storm Current,952531070,300,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:233,DamageDone,Storm Current,952531070,300,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:268,DamageDone,Mother Nature's Protest,963754730,768,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:268,DamageDone,Mother Nature's Protest,963754730,3,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:28:268,DamageDone,Decisive Sniping,964500434,41145,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:268,DamageDone,Decisive Sniping,964500434,41145,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:268,DamageDone,Decisive Sniping,964500434,41145,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:302,DamageDone,Storm Current,952531070,774,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:302,DamageDone,Storm Current,952531070,80,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:28:302,DamageDone,Storm Current,952531070,774,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:371,DamageDone,Decisive Sniping,964500434,29449,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:371,DamageDone,Decisive Sniping,964500434,11508,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:371,DamageDone,Decisive Sniping,964500434,11508,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:405,DamageDone,Mother Nature's Protest,963754730,286,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:28:405,DamageDone,Mother Nature's Protest,963754730,41,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:28:405,DamageDone,Storm Current,952531070,315,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:28:405,DamageDone,Storm Current,952531070,691,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:405,DamageDone,Storm Current,952531070,691,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:509,DamageDone,Strafing,944953936,4498,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:28:509,DamageDone,Strafing,944953936,14097,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:509,DamageDone,Strafing,944953936,14097,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:509,DamageDone,Strafing,944953936,4018,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:28:630,DamageDone,Mother Nature's Protest,963754730,685,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:630,DamageDone,Mother Nature's Protest,963754730,62,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:28:630,DamageDone,Mother Nature's Protest,963754730,266,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:630,DamageDone,Mother Nature's Protest,963754730,685,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:630,DamageDone,Mother Nature's Protest,963754730,151,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:28:649,DamageDone,Storm Current,952531070,268,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:650,DamageDone,Storm Current,952531070,691,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:650,DamageDone,Storm Current,952531070,691,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:650,DamageDone,Storm Current,952531070,268,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:959,DamageDone,Strafing,944299709,14119,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:959,DamageDone,Strafing,944299709,3067,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:28:959,DamageDone,Strafing,944299709,5560,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:28:959,DamageDone,Strafing,944299709,14119,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:29:062,DamageDone,Mother Nature's Protest,963754730,324,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:29:062,DamageDone,Mother Nature's Protest,963754730,686,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:29:062,DamageDone,Mother Nature's Protest,963754730,43,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:29:062,DamageDone,Mother Nature's Protest,963754730,686,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:29:063,DamageDone,Mother Nature's Protest,963754730,266,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:29:063,DamageDone,Storm Current,952531070,223,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:29:063,DamageDone,Storm Current,952531070,692,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:29:063,DamageDone,Storm Current,952531070,692,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:29:063,DamageDone,Storm Current,952531070,136,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:29:458,DamageDone,Mother Nature's Protest,963754730,655,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:29:459,DamageDone,Mother Nature's Protest,963754730,41,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:29:459,DamageDone,Mother Nature's Protest,963754730,655,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:29:459,DamageDone,Mother Nature's Protest,963754730,254,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:29:459,DamageDone,Mother Nature's Protest,963754730,254,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:30:079,DamageDone,Decisive Sniping,964631505,33014,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:30:079,DamageDone,Storm Current,952531070,658,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:30:286,DamageDone,Quick Fire,965287183,6992,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:30:373,DamageDone,Storm Current,952531070,250,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:30:407,DamageDone,Quick Fire,965287183,6974,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:30:459,DamageDone,Mother Nature's Protest,963754730,354,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:30:459,DamageDone,Mother Nature's Protest,963754730,252,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:30:494,DamageDone,Storm Current,952531070,278,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:30:563,DamageDone,Quick Fire,964762401,7588,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:30:597,DamageDone,Mother Nature's Protest,963754730,711,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:30:597,DamageDone,Mother Nature's Protest,963754730,13,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:30:632,DamageDone,Quick Fire,964762401,16926,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:30:649,DamageDone,Quick Fire,964762401,3207,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:30:686,DamageDone,Mother Nature's Protest,963754730,269,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:30:775,DamageDone,Quick Fire,964762401,19731,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:30:843,DamageDone,Storm Current,952531070,749,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:30:964,DamageDone,Quick Fire,964762401,19301,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:31:016,DamageDone,Roxie's Arrowhead,947532344,1658,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:31:016,DamageDone,Mother Nature's Protest,963754730,737,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:31:016,DamageDone,Mother Nature's Protest,963754730,44,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:31:049,DamageDone,Storm Current,952531070,765,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:31:136,DamageDone,Mother Nature's Protest,963754730,240,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:31:431,DamageDone,Mother Nature's Protest,963754730,291,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:31:431,DamageDone,Mother Nature's Protest,963754730,119,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:31:780,DamageDone,Mother Nature's Protest,963754730,673,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:31:780,DamageDone,Mother Nature's Protest,963754730,104,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:32:195,DamageDone,Basic Shot,947551927,0,0,0,kMiss,Demo,Dragaryle
20260909-18:37:32:368,DamageDone,Basic Shot,947523317,1398,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:32:491,DamageDone,Storm Current,952531070,673,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:32:749,DamageDone,Basic Shot,947457802,1391,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:32:817,DamageDone,Mother Nature's Protest,963754730,262,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:32:853,DamageDone,Storm Current,952531070,669,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:33:131,DamageDone,Mother Nature's Protest,963754730,626,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:33:131,DamageDone,Mother Nature's Protest,963754730,73,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:33:234,DamageDone,Basic Shot,947551927,1318,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:33:371,DamageDone,Mother Nature's Protest,963754730,241,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:33:371,DamageDone,Mother Nature's Protest,963754730,67,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:33:371,DamageDone,Storm Current,952531070,629,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:33:371,DamageDone,Basic Shot,947523317,3179,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:33:492,DamageDone,Storm Current,952531070,243,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:33:803,DamageDone,Basic Shot,947457802,3155,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:33:804,DamageDone,Mother Nature's Protest,963754730,240,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:33:804,DamageDone,Mother Nature's Protest,963754730,40,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:33:875,DamageDone,Storm Current,952531070,242,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:33:910,DamageDone,Mother Nature's Protest,963754730,618,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:33:910,DamageDone,Mother Nature's Protest,963754730,25,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:34:203,DamageDone,Basic Shot,947551927,3658,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:34:237,DamageDone,Mother Nature's Protest,963754730,291,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:34:306,DamageDone,Storm Current,952531070,757,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:34:413,DamageDone,Basic Shot,947523317,3656,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:34:534,DamageDone,Storm Current,952531070,294,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:34:689,DamageDone,Mother Nature's Protest,963754730,292,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:34:878,DamageDone,Mother Nature's Protest,963754730,757,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:34:879,DamageDone,Mother Nature's Protest,963754730,230,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:34:914,DamageDone,Basic Shot,947457802,1501,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:35:051,DamageDone,Storm Current,952531070,296,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:35:457,DamageDone,Mother Nature's Protest,963754730,764,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:35:457,DamageDone,Mother Nature's Protest,963754730,164,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:35:577,DamageDone,Basic Shot,947551927,1515,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:35:720,DamageDone,Storm Current,952531070,771,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:35:893,DamageDone,Basic Shot,947523317,3713,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:36:014,DamageDone,Storm Current,952531070,275,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:36:273,DamageDone,Mother Nature's Protest,963754730,275,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:36:273,DamageDone,Mother Nature's Protest,963754730,234,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:36:669,DamageDone,Mother Nature's Protest,963754730,710,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:36:670,DamageDone,Mother Nature's Protest,963754730,44,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:37:653,DamageDone,Mother Nature's Protest,963754730,273,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:38:688,DamageDone,Mother Nature's Protest,963754730,288,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:39:674,DamageDone,Mother Nature's Protest,963754730,287,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:41:514,DamageDone,Detonation Mark,953371309,2613,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:41:841,DamageDone,Mother Nature's Protest,963754730,222,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:42:138,DamageDone,Quick Fire,964893236,1382,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:42:172,DamageDone,Quick Fire,964893236,13401,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:42:225,DamageDone,Storm Current,952531070,257,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:42:260,DamageDone,Quick Fire,964893236,6254,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:42:260,DamageDone,Storm Current,952531070,179,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:42:293,DamageDone,Quick Fire,964893236,7673,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:42:328,DamageDone,Storm Current,952531070,331,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:42:328,DamageDone,Quick Fire,964893236,6408,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:42:363,DamageDone,Storm Current,952531070,199,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:42:449,DamageDone,Mother Nature's Protest,963754730,258,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:42:449,DamageDone,Storm Current,952531070,261,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:42:466,DamageDone,Mother Nature's Protest,963754730,514,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:42:466,DamageDone,Mother Nature's Protest,963754730,12,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:42:517,DamageDone,Mother Nature's Protest,963754730,617,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:42:518,DamageDone,Mother Nature's Protest,963754730,1,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:42:535,DamageDone,Basic Shot,947523317,2883,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:42:603,DamageDone,Mother Nature's Protest,963754730,284,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:42:603,DamageDone,Mother Nature's Protest,963754730,3,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:42:621,DamageDone,Mother Nature's Protest,963754730,615,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:42:621,DamageDone,Mother Nature's Protest,963754730,3,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:42:638,DamageDone,Storm Current,952531070,311,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:42:707,DamageDone,Ensnaring Arrow,963973967,5826,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:42:831,DamageDone,Storm Current,952531070,621,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:42:868,DamageDone,Mother Nature's Protest,963754730,86,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:42:868,DamageDone,Mother Nature's Protest,963754730,10,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:42:990,DamageDone,Blade Storm,945408027,1857,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:43:043,DamageDone,Mother Nature's Protest,963754730,273,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:43:043,DamageDone,Mother Nature's Protest,963754730,6,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:43:077,DamageDone,Storm Current,952531070,276,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:43:078,DamageDone,Blade Storm,945408027,4449,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:43:148,DamageDone,Storm Current,952531070,276,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:43:182,DamageDone,Blade Storm,945408027,1156,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:43:251,DamageDone,Mother Nature's Protest,963754730,176,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:43:251,DamageDone,Storm Current,952531070,276,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:43:285,DamageDone,Blade Storm,945408027,4449,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:43:372,DamageDone,Mother Nature's Protest,963754730,107,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:43:372,DamageDone,Mother Nature's Protest,963754730,57,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:43:372,DamageDone,Storm Current,952531070,276,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:43:372,DamageDone,Blade Storm,945408027,1359,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:43:475,DamageDone,Storm Current,952531070,276,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:43:475,DamageDone,Mother Nature's Protest,963754730,651,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:43:475,DamageDone,Mother Nature's Protest,963754730,13,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:43:561,DamageDone,Mother Nature's Protest,963754730,651,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:43:561,DamageDone,Mother Nature's Protest,963754730,21,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:43:664,DamageDone,Mother Nature's Protest,963754730,651,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:43:664,DamageDone,Mother Nature's Protest,963754730,16,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:44:532,DamageDone,Detonation Mark,953371309,22233,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:44:653,DamageDone,Storm Current,952531070,656,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:44:653,DamageDone,Mother Nature's Protest,963754730,250,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:44:844,DamageDone,Mother Nature's Protest,963754730,273,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:44:845,DamageDone,Mother Nature's Protest,963754730,47,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:45:262,DamageDone,Decisive Sniping,964500434,207782,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:45:279,DamageDone,Storm Current,952531070,656,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:45:507,DamageDone,Mother Nature's Protest,963754730,651,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:45:507,DamageDone,Mother Nature's Protest,963754730,96,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:45:661,DamageDone,Basic Shot,947551927,1778,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:45:748,DamageDone,Storm Current,952531070,351,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:45:959,DamageDone,Mother Nature's Protest,963754730,103,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:45:959,DamageDone,Mother Nature's Protest,963754730,113,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:46:201,DamageDone,Decisive Sniping,964500434,74683,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:201,DamageDone,Decisive Sniping,964500434,74683,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:201,DamageDone,Decisive Sniping,964500434,74683,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:201,DamageDone,Storm Current,952531070,155,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:46:201,DamageDone,Storm Current,952531070,711,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:201,DamageDone,Storm Current,952531070,276,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:292,DamageDone,Decisive Sniping,964500434,80956,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:292,DamageDone,Decisive Sniping,964500434,80956,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:292,DamageDone,Decisive Sniping,964500434,31496,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:311,DamageDone,Storm Current,952531070,276,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:311,DamageDone,Storm Current,952531070,276,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:311,DamageDone,Storm Current,952531070,711,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:399,DamageDone,Decisive Sniping,964500434,31496,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:399,DamageDone,Decisive Sniping,964500434,39806,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:46:399,DamageDone,Decisive Sniping,964500434,80956,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:399,DamageDone,Storm Current,952531070,107,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:46:399,DamageDone,Storm Current,952531070,109,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:46:399,DamageDone,Storm Current,952531070,711,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:46:954,DamageDone,Mother Nature's Protest,963754730,250,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:47:749,DamageDone,Decisive Sniping,964500434,159832,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:47:784,DamageDone,Storm Current,952531070,273,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:47:938,DamageDone,Mother Nature's Protest,963754730,272,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:47:973,DamageDone,Mother Nature's Protest,963754730,700,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:47:973,DamageDone,Mother Nature's Protest,963754730,5,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:48:042,DamageDone,Basic Shot,947551927,1430,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:48:183,DamageDone,Storm Current,952531070,273,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:48:270,DamageDone,Basic Shot,947523317,3556,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:48:374,DamageDone,Mother Nature's Protest,963754730,705,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:48:562,DamageDone,Mother Nature's Protest,963754730,793,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:48:562,DamageDone,Mother Nature's Protest,963754730,164,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:48:615,DamageDone,Decisive Sniping,964500434,93343,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:48:616,DamageDone,Decisive Sniping,964500434,45465,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:48:616,DamageDone,Decisive Sniping,964500434,36303,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:48:701,DamageDone,Decisive Sniping,964500434,26292,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:48:701,DamageDone,Decisive Sniping,964500434,41245,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:48:701,DamageDone,Decisive Sniping,964500434,23538,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:48:839,DamageDone,Decisive Sniping,964500434,93343,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:48:839,DamageDone,Decisive Sniping,964500434,36303,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:48:839,DamageDone,Decisive Sniping,964500434,50045,0,1,kMaxDamageByNormal,Demo,Dragaryle
20260909-18:37:48:960,DamageDone,Decisive Sniping,964500434,36303,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:48:960,DamageDone,Decisive Sniping,964500434,93343,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:48:960,DamageDone,Decisive Sniping,964500434,36303,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:49:580,DamageDone,Mother Nature's Protest,963754730,305,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:50:534,DamageDone,Decisive Sniping,964631505,601014,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:50:568,DamageDone,Mother Nature's Protest,963754730,290,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:50:742,DamageDone,Mother Nature's Protest,963754730,377,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:50:742,DamageDone,Mother Nature's Protest,963754730,59,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:50:846,DamageDone,Basic Shot,947551927,2235,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:51:023,DamageDone,Basic Shot,947523317,1882,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:128,DamageDone,Mother Nature's Protest,963754730,884,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:128,DamageDone,Mother Nature's Protest,963754730,152,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:51:336,DamageDone,Mother Nature's Protest,963754730,494,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:51:336,DamageDone,Mother Nature's Protest,963754730,17,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:51:336,DamageDone,Roxie's Arrowhead,947532344,10683,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:387,DamageDone,Basic Shot,947457802,1882,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:477,DamageDone,Decisive Sniping,964631505,45602,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:51:477,DamageDone,Decisive Sniping,964631505,42539,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:477,DamageDone,Decisive Sniping,964631505,109416,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:512,DamageDone,Ensnaring Arrow,963973967,10735,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:563,DamageDone,Decisive Sniping,964631505,109416,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:563,DamageDone,Decisive Sniping,964631505,42539,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:563,DamageDone,Decisive Sniping,964631505,109416,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:703,DamageDone,Decisive Sniping,964631505,124894,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:704,DamageDone,Decisive Sniping,964631505,73939,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:51:704,DamageDone,Decisive Sniping,964631505,124894,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:704,DamageDone,Mother Nature's Protest,963754730,392,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:704,DamageDone,Mother Nature's Protest,963754730,35,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:51:789,DamageDone,Quick Fire,964762401,35513,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:826,DamageDone,Mother Nature's Protest,963754730,392,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:826,DamageDone,Mother Nature's Protest,963754730,14,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:51:826,DamageDone,Quick Fire,964762401,11934,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:859,DamageDone,Storm Current,952531070,377,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:51:893,DamageDone,Quick Fire,964762401,14390,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:894,DamageDone,Storm Current,952531070,394,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:51:980,DamageDone,Storm Current,952531070,453,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:52:014,DamageDone,Quick Fire,964762401,15097,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:52:050,DamageDone,Mother Nature's Protest,963754730,1011,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:52:050,DamageDone,Mother Nature's Protest,963754730,37,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:52:083,DamageDone,Storm Current,952531070,204,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:52:119,DamageDone,Mother Nature's Protest,963754730,327,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:52:119,DamageDone,Mother Nature's Protest,963754730,11,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:52:187,DamageDone,Mother Nature's Protest,963754730,1011,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:52:187,DamageDone,Mother Nature's Protest,963754730,24,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:52:309,DamageDone,Mother Nature's Protest,963754730,1011,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:52:309,DamageDone,Mother Nature's Protest,963754730,36,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:52:517,DamageDone,Detonation Mark,953371309,18484,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:52:640,DamageDone,Storm Current,952531070,1018,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:52:866,DamageDone,Basic Shot,947523317,5284,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:52:866,DamageDone,Mother Nature's Protest,963754730,1011,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:52:866,DamageDone,Mother Nature's Protest,963754730,87,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:52:933,DamageDone,Strafing,945674044,25321,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:52:933,DamageDone,Strafing,945674044,25321,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:52:933,DamageDone,Strafing,945674044,11537,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:52:933,DamageDone,Strafing,945674044,25321,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:52:968,DamageDone,Storm Current,952531070,169,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:53:056,DamageDone,Storm Current,952531070,1018,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:056,DamageDone,Storm Current,952531070,395,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:056,DamageDone,Storm Current,952531070,475,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:53:056,DamageDone,Storm Current,952531070,395,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:174,DamageDone,Mother Nature's Protest,963754730,392,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:175,DamageDone,Mother Nature's Protest,963754730,121,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:53:243,DamageDone,Mother Nature's Protest,963754730,1011,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:243,DamageDone,Mother Nature's Protest,963754730,18,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:53:244,DamageDone,Mother Nature's Protest,963754730,1011,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:244,DamageDone,Mother Nature's Protest,963754730,1011,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:244,DamageDone,Mother Nature's Protest,963754730,392,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:313,DamageDone,Strafing,944953936,5457,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:53:313,DamageDone,Strafing,944953936,25339,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:313,DamageDone,Strafing,944953936,25339,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:313,DamageDone,Strafing,944953936,14811,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:53:417,DamageDone,Storm Current,952531070,511,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:53:417,DamageDone,Storm Current,952531070,395,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:417,DamageDone,Storm Current,952531070,395,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:417,DamageDone,Storm Current,952531070,395,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:605,DamageDone,Mother Nature's Protest,963754730,393,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:606,DamageDone,Mother Nature's Protest,963754730,140,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:53:606,DamageDone,Mother Nature's Protest,963754730,1012,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:606,DamageDone,Mother Nature's Protest,963754730,393,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:53:606,DamageDone,Roxie's Arrowhead,947532344,12231,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:606,DamageDone,Mother Nature's Protest,963754730,1012,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:692,DamageDone,Strafing,944299709,25357,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:692,DamageDone,Strafing,944299709,25357,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:692,DamageDone,Strafing,944299709,25357,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:692,DamageDone,Strafing,944299709,13971,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:53:796,DamageDone,Storm Current,952531070,1020,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:797,DamageDone,Storm Current,952531070,395,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:797,DamageDone,Storm Current,952531070,302,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:53:797,DamageDone,Storm Current,952531070,577,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:53:951,DamageDone,Blade Storm,945710601,9995,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:53:951,DamageDone,Blade Storm,945710601,9995,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:004,DamageDone,Mother Nature's Protest,963754730,606,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:54:004,DamageDone,Mother Nature's Protest,963754730,151,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:54:004,DamageDone,Mother Nature's Protest,963754730,1012,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:004,DamageDone,Mother Nature's Protest,963754730,1012,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:004,DamageDone,Mother Nature's Protest,963754730,1012,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:004,DamageDone,Roxie's Arrowhead,947532344,12933,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:059,DamageDone,Storm Current,952531070,204,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:54:059,DamageDone,Storm Current,952531070,180,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:54:059,DamageDone,Blade Storm,945710601,2788,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:54:059,DamageDone,Blade Storm,945710601,3960,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:116,DamageDone,Storm Current,952531070,204,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:54:116,DamageDone,Storm Current,952531070,191,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:54:166,DamageDone,Blade Storm,945710601,9995,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:167,DamageDone,Blade Storm,945710601,3960,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:237,DamageDone,Storm Current,952531070,396,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:237,DamageDone,Storm Current,952531070,103,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:54:237,DamageDone,Mother Nature's Protest,963754730,318,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:54:237,DamageDone,Mother Nature's Protest,963754730,91,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:54:237,DamageDone,Mother Nature's Protest,963754730,391,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:255,DamageDone,Blade Storm,945710601,2510,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:54:255,DamageDone,Blade Storm,945710601,4878,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:54:324,DamageDone,Mother Nature's Protest,963754730,1009,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:325,DamageDone,Mother Nature's Protest,963754730,30,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:54:325,DamageDone,Mother Nature's Protest,963754730,1009,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:325,DamageDone,Storm Current,952531070,394,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:325,DamageDone,Storm Current,952531070,394,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:361,DamageDone,Blade Storm,945710601,9995,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:361,DamageDone,Blade Storm,945710601,9995,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:414,DamageDone,Mother Nature's Protest,963754730,392,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:414,DamageDone,Mother Nature's Protest,963754730,25,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:54:414,DamageDone,Mother Nature's Protest,963754730,1010,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:414,DamageDone,Storm Current,952531070,417,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:54:414,DamageDone,Storm Current,952531070,395,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:500,DamageDone,Mother Nature's Protest,963754730,1010,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:500,DamageDone,Mother Nature's Protest,963754730,22,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:54:500,DamageDone,Mother Nature's Protest,963754730,392,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:620,DamageDone,Roxie's Arrowhead,947532344,5006,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:620,DamageDone,Mother Nature's Protest,963754730,1010,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:54:620,DamageDone,Mother Nature's Protest,963754730,25,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:54:621,DamageDone,Mother Nature's Protest,963754730,392,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:55:626,DamageDone,Mother Nature's Protest,963754730,389,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:55:922,DamageDone,Decisive Sniping,964500434,285187,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:55:940,DamageDone,Storm Current,952531070,968,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:56:165,DamageDone,Mother Nature's Protest,963754730,119,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:56:165,DamageDone,Mother Nature's Protest,963754730,200,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:56:253,DamageDone,Basic Shot,947551927,4057,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:56:377,DamageDone,Storm Current,952531070,793,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:56:377,DamageDone,Deadly Viper,940584840,23,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:56:572,DamageDone,Mother Nature's Protest,963754730,158,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:56:572,DamageDone,Mother Nature's Protest,963754730,134,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:56:657,DamageDone,Basic Shot,947523317,0,0,0,kMiss,Demo,Dragaryle
20260909-18:37:56:761,DamageDone,Decisive Sniping,964500434,43413,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:56:761,DamageDone,Decisive Sniping,964500434,48453,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:56:761,DamageDone,Decisive Sniping,964500434,124654,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:56:779,DamageDone,Storm Current,952531070,87,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:56:779,DamageDone,Deadly Viper,940584840,61,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:56:779,DamageDone,Storm Current,952531070,375,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:56:779,DamageDone,Storm Current,952531070,375,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:56:883,DamageDone,Decisive Sniping,964500434,48453,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:56:883,DamageDone,Decisive Sniping,964500434,48453,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:56:883,DamageDone,Decisive Sniping,964500434,124654,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:56:919,DamageDone,Storm Current,952531070,967,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:56:919,DamageDone,Deadly Viper,940584840,33,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:56:919,DamageDone,Storm Current,952531070,967,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:56:919,DamageDone,Storm Current,952531070,967,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:007,DamageDone,Basic Shot,947457802,4893,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:007,DamageDone,Decisive Sniping,964500434,48453,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:007,DamageDone,Decisive Sniping,964500434,124654,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:007,DamageDone,Decisive Sniping,964500434,38212,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:57:007,DamageDone,Storm Current,952531070,181,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:57:007,DamageDone,Deadly Viper,940584840,46,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:57:007,DamageDone,Storm Current,952531070,967,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:007,DamageDone,Storm Current,952531070,967,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:112,DamageDone,Decisive Sniping,964500434,48453,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:112,DamageDone,Decisive Sniping,964500434,38212,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:57:112,DamageDone,Decisive Sniping,964500434,48453,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:112,DamageDone,Storm Current,952531070,375,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:112,DamageDone,Deadly Viper,940584840,55,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:57:112,DamageDone,Storm Current,952531070,967,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:112,DamageDone,Deadly Viper,940584840,13,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:57:112,DamageDone,Storm Current,952531070,169,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:57:112,DamageDone,Storm Current,952531070,967,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:318,DamageDone,Roxie's Arrowhead,947532344,11143,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:318,DamageDone,Mother Nature's Protest,963754730,322,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:57:318,DamageDone,Mother Nature's Protest,963754730,270,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:57:494,DamageDone,Detonation Mark,953371309,110928,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:57:631,DamageDone,Storm Current,952531070,336,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:632,DamageDone,Deadly Viper,940584840,399,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:57:821,DamageDone,Mother Nature's Protest,963754730,333,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:57:821,DamageDone,Mother Nature's Protest,963754730,73,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:58:573,DamageDone,Decisive Sniping,964631505,213940,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:58:627,DamageDone,Storm Current,952531070,257,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:58:628,DamageDone,Deadly Viper,940584840,707,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:58:780,DamageDone,Mother Nature's Protest,963754730,149,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:58:780,DamageDone,Mother Nature's Protest,963754730,176,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:58:866,DamageDone,Basic Shot,947551927,4339,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:58:990,DamageDone,Storm Current,952531070,336,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:58:990,DamageDone,Deadly Viper,940584840,465,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:59:059,DamageDone,Basic Shot,947523317,4339,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:162,DamageDone,Storm Current,952531070,411,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:59:162,DamageDone,Deadly Viper,940584840,88,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:59:196,DamageDone,Mother Nature's Protest,963754730,420,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:59:372,DamageDone,Mother Nature's Protest,963754730,111,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:59:372,DamageDone,Mother Nature's Protest,963754730,196,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:59:429,DamageDone,Decisive Sniping,964631505,110224,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:429,DamageDone,Decisive Sniping,964631505,42853,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:429,DamageDone,Decisive Sniping,964631505,110224,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:429,DamageDone,Basic Shot,947457802,4339,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:429,DamageDone,Storm Current,952531070,867,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:429,DamageDone,Deadly Viper,940584840,608,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:59:430,DamageDone,Storm Current,952531070,867,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:430,DamageDone,Storm Current,952531070,867,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:498,DamageDone,Detonation Mark,953371309,5843,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:516,DamageDone,Decisive Sniping,964631505,42853,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:516,DamageDone,Decisive Sniping,964631505,110224,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:516,DamageDone,Decisive Sniping,964631505,12497,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:59:551,DamageDone,Storm Current,952531070,867,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:551,DamageDone,Deadly Viper,940584840,174,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:59:552,DamageDone,Storm Current,952531070,62,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:59:552,DamageDone,Storm Current,952531070,336,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:552,DamageDone,Storm Current,952531070,336,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:640,DamageDone,Storm Current,952531070,867,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:640,DamageDone,Deadly Viper,940584840,125,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:59:641,DamageDone,Decisive Sniping,964631505,37918,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:641,DamageDone,Decisive Sniping,964631505,97508,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:641,DamageDone,Decisive Sniping,964631505,37918,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:641,DamageDone,Storm Current,952531070,297,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:641,DamageDone,Deadly Viper,940584840,49,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:59:641,DamageDone,Storm Current,952531070,268,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:59:641,DamageDone,Storm Current,952531070,297,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:746,DamageDone,Mother Nature's Protest,963754730,760,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:746,DamageDone,Mother Nature's Protest,963754730,48,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:59:747,DamageDone,Decisive Sniping,964631505,34271,0,1,kNormalHit,Demo,Dragaryle
20260909-18:37:59:747,DamageDone,Decisive Sniping,964631505,97508,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:747,DamageDone,Decisive Sniping,964631505,97508,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:764,DamageDone,Deadly Viper,940584840,234,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:59:834,DamageDone,Roxie's Arrowhead,947532344,5608,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:834,DamageDone,Mother Nature's Protest,963754730,295,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:834,DamageDone,Mother Nature's Protest,963754730,22,0,0,kNormalHit,Demo,Dragaryle
20260909-18:37:59:867,DamageDone,Ensnaring Arrow,963973967,8775,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:37:59:974,DamageDone,Deadly Viper,940584840,466,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:00:168,DamageDone,Basic Shot,947523317,0,0,0,kMiss,Demo,Dragaryle
20260909-18:38:00:202,DamageDone,Mother Nature's Protest,963754730,859,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:00:202,DamageDone,Mother Nature's Protest,963754730,66,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:00:968,DamageDone,Deadly Viper,940584840,826,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:01:211,DamageDone,Mother Nature's Protest,963754730,336,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:007,DamageDone,Deadly Viper,940584840,840,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:126,DamageDone,Decisive Sniping,964631505,702281,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:144,DamageDone,Deadly Viper,940584840,117,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:199,DamageDone,Mother Nature's Protest,963754730,326,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:335,DamageDone,Mother Nature's Protest,963754730,966,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:461,DamageDone,Basic Shot,947551927,2060,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:563,DamageDone,Storm Current,952531070,388,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:563,DamageDone,Deadly Viper,940584840,501,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:598,DamageDone,Quick Fire,964762401,36339,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:649,DamageDone,Quick Fire,964762401,12475,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:702,DamageDone,Storm Current,952531070,606,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:02:702,DamageDone,Deadly Viper,940584840,143,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:736,DamageDone,Quick Fire,964762401,14182,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:736,DamageDone,Storm Current,952531070,388,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:736,DamageDone,Deadly Viper,940584840,35,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:754,DamageDone,Mother Nature's Protest,963754730,385,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:754,DamageDone,Mother Nature's Protest,963754730,228,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:792,DamageDone,Storm Current,952531070,230,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:792,DamageDone,Deadly Viper,940584840,47,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:844,DamageDone,Quick Fire,964762401,14182,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:879,DamageDone,Storm Current,952531070,388,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:879,DamageDone,Deadly Viper,940584840,60,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:879,DamageDone,Mother Nature's Protest,963754730,993,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:879,DamageDone,Mother Nature's Protest,963754730,29,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:965,DamageDone,Mother Nature's Protest,963754730,321,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:965,DamageDone,Mother Nature's Protest,963754730,14,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:982,DamageDone,Decisive Sniping,964631505,135779,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:982,DamageDone,Decisive Sniping,964631505,135779,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:982,DamageDone,Decisive Sniping,964631505,52770,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:02:999,DamageDone,Mother Nature's Protest,963754730,480,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:02:999,DamageDone,Mother Nature's Protest,963754730,5,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:02:999,DamageDone,Storm Current,952531070,388,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:000,DamageDone,Deadly Viper,940584840,245,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:03:000,DamageDone,Storm Current,952531070,495,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:03:000,DamageDone,Storm Current,952531070,447,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:03:088,DamageDone,Mother Nature's Protest,963754730,993,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:088,DamageDone,Mother Nature's Protest,963754730,18,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:03:088,DamageDone,Decisive Sniping,964631505,24810,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:03:088,DamageDone,Decisive Sniping,964631505,135779,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:088,DamageDone,Decisive Sniping,964631505,135779,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:123,DamageDone,Storm Current,952531070,472,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:03:123,DamageDone,Deadly Viper,940584840,127,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:03:123,DamageDone,Storm Current,952531070,1001,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:123,DamageDone,Storm Current,952531070,388,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:208,DamageDone,Decisive Sniping,964631505,135779,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:208,DamageDone,Decisive Sniping,964631505,52770,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:208,DamageDone,Decisive Sniping,964631505,52770,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:208,DamageDone,Storm Current,952531070,388,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:208,DamageDone,Deadly Viper,940584840,316,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:03:209,DamageDone,Storm Current,952531070,388,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:209,DamageDone,Storm Current,952531070,102,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:03:312,DamageDone,Decisive Sniping,964631505,20002,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:03:312,DamageDone,Decisive Sniping,964631505,15652,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:03:312,DamageDone,Decisive Sniping,964631505,135779,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:330,DamageDone,Storm Current,952531070,1001,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:330,DamageDone,Deadly Viper,940584840,313,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:03:330,DamageDone,Storm Current,952531070,388,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:330,DamageDone,Storm Current,952531070,388,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:882,DamageDone,Detonation Mark,953371309,102981,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:03:989,DamageDone,Storm Current,952531070,1001,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:03:989,DamageDone,Deadly Viper,940584840,1889,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:04:075,DamageDone,Mother Nature's Protest,963754730,90,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:04:196,DamageDone,Mother Nature's Protest,963754730,385,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:04:196,DamageDone,Mother Nature's Protest,963754730,10,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:04:645,DamageDone,Decisive Sniping,964631505,267856,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:04:696,DamageDone,Storm Current,952531070,374,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:04:696,DamageDone,Deadly Viper,940584840,1935,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:04:869,DamageDone,Mother Nature's Protest,963754730,119,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:04:869,DamageDone,Mother Nature's Protest,963754730,99,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:007,DamageDone,Ensnaring Arrow,963973967,4250,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:128,DamageDone,Storm Current,952531070,547,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:05:128,DamageDone,Deadly Viper,940584840,296,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:299,DamageDone,Blade Storm,945408027,3077,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:05:336,DamageDone,Roxie's Arrowhead,947532344,3994,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:05:336,DamageDone,Mother Nature's Protest,963754730,957,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:336,DamageDone,Mother Nature's Protest,963754730,67,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:405,DamageDone,Storm Current,952531070,427,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:05:405,DamageDone,Deadly Viper,940584840,158,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:405,DamageDone,Blade Storm,945408027,3117,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:509,DamageDone,Storm Current,952531070,965,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:509,DamageDone,Deadly Viper,940584840,97,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:509,DamageDone,Blade Storm,945408027,7823,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:509,DamageDone,Decisive Sniping,964631505,119823,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:509,DamageDone,Decisive Sniping,964631505,46578,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:509,DamageDone,Decisive Sniping,964631505,46578,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:509,DamageDone,Storm Current,952531070,965,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:509,DamageDone,Deadly Viper,940584840,29,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:510,DamageDone,Storm Current,952531070,374,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:510,DamageDone,Storm Current,952531070,136,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:565,DamageDone,Storm Current,952531070,175,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:565,DamageDone,Deadly Viper,940584840,50,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:601,DamageDone,Basic Shot,947523317,1232,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:601,DamageDone,Mother Nature's Protest,963754730,371,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:601,DamageDone,Mother Nature's Protest,963754730,92,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:601,DamageDone,Blade Storm,945408027,3117,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:692,DamageDone,Decisive Sniping,964631505,119823,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:692,DamageDone,Decisive Sniping,964631505,119823,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:692,DamageDone,Decisive Sniping,964631505,119823,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:692,DamageDone,Storm Current,952531070,535,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:05:693,DamageDone,Deadly Viper,940584840,110,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:693,DamageDone,Storm Current,952531070,374,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:693,DamageDone,Deadly Viper,940584840,6,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:693,DamageDone,Storm Current,952531070,979,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:693,DamageDone,Storm Current,952531070,428,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:05:693,DamageDone,Storm Current,952531070,467,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:05:693,DamageDone,Mother Nature's Protest,963754730,404,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:05:693,DamageDone,Mother Nature's Protest,963754730,46,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:693,DamageDone,Roxie's Arrowhead,947532344,10862,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:727,DamageDone,Blade Storm,945408027,3910,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:05:727,DamageDone,Decisive Sniping,964631505,10496,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:727,DamageDone,Decisive Sniping,964631505,121742,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:727,DamageDone,Decisive Sniping,964631505,47323,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:763,DamageDone,Storm Current,952531070,175,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:763,DamageDone,Deadly Viper,940584840,42,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:763,DamageDone,Storm Current,952531070,980,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:763,DamageDone,Storm Current,952531070,980,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:763,DamageDone,Mother Nature's Protest,963754730,973,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:763,DamageDone,Mother Nature's Protest,963754730,5,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:780,DamageDone,Storm Current,952531070,380,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:780,DamageDone,Deadly Viper,940584840,12,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:849,DamageDone,Decisive Sniping,964631505,121976,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:849,DamageDone,Decisive Sniping,964631505,121976,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:849,DamageDone,Decisive Sniping,964631505,121976,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:849,DamageDone,Storm Current,952531070,983,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:849,DamageDone,Deadly Viper,940584840,52,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:849,DamageDone,Storm Current,952531070,983,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:849,DamageDone,Storm Current,952531070,568,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:05:884,DamageDone,Mother Nature's Protest,963754730,1094,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:885,DamageDone,Mother Nature's Protest,963754730,40,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:05:885,DamageDone,Mother Nature's Protest,963754730,1094,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:05:885,DamageDone,Mother Nature's Protest,963754730,6,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:06:024,DamageDone,Mother Nature's Protest,963754730,238,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:06:024,DamageDone,Mother Nature's Protest,963754730,39,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:06:110,DamageDone,Quick Fire,964893236,33562,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:06:162,DamageDone,Quick Fire,964893236,28901,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:06:197,DamageDone,Storm Current,952531070,223,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:06:197,DamageDone,Deadly Viper,940584840,553,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:06:216,DamageDone,Quick Fire,964893236,13099,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:06:234,DamageDone,Storm Current,952531070,480,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:06:234,DamageDone,Deadly Viper,940584840,86,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:06:287,DamageDone,Quick Fire,964893236,11819,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:06:287,DamageDone,Storm Current,952531070,1103,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:06:287,DamageDone,Deadly Viper,940584840,46,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:06:337,DamageDone,Quick Fire,964893236,13090,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:06:373,DamageDone,Storm Current,952531070,427,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:06:373,DamageDone,Deadly Viper,940584840,45,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:06:392,DamageDone,Mother Nature's Protest,963754730,1094,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:06:392,DamageDone,Mother Nature's Protest,963754730,171,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:06:392,DamageDone,Storm Current,952531070,427,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:06:392,DamageDone,Deadly Viper,940584840,53,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:06:481,DamageDone,Mother Nature's Protest,963754730,114,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:06:481,DamageDone,Mother Nature's Protest,963754730,10,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:06:499,DamageDone,Mother Nature's Protest,963754730,1094,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:06:499,DamageDone,Mother Nature's Protest,963754730,21,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:06:569,DamageDone,Mother Nature's Protest,963754730,912,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:06:569,DamageDone,Mother Nature's Protest,963754730,26,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:06:603,DamageDone,Mother Nature's Protest,963754730,1094,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:06:603,DamageDone,Mother Nature's Protest,963754730,15,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:07:106,DamageDone,Decisive Sniping,964631505,308492,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:07:106,DamageDone,Storm Current,952531070,982,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:07:106,DamageDone,Deadly Viper,940584840,767,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:07:278,DamageDone,Roxie's Arrowhead,947532344,4060,1,0,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:07:278,DamageDone,Mother Nature's Protest,963754730,382,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:07:278,DamageDone,Mother Nature's Protest,963754730,110,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:07:347,DamageDone,Basic Shot,947551927,604,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:07:470,DamageDone,Storm Current,952531070,983,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:07:470,DamageDone,Deadly Viper,940584840,395,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:07:555,DamageDone,Basic Shot,947523317,1690,0,1,kNormalHit,Demo,Dragaryle
20260909-18:38:07:677,DamageDone,Mother Nature's Protest,963754730,974,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:07:677,DamageDone,Mother Nature's Protest,963754730,146,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:07:677,DamageDone,Storm Current,952531070,983,1,1,kMaxDamageByCriticalDecision,Demo,Dragaryle
20260909-18:38:07:677,DamageDone,Deadly Viper,940584840,573,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:07:780,DamageDone,Deadly Viper,940584840,285,0,0,kNormalHit,Demo,Dragaryle
20260909-18:38:07:781,DamageDone,Mother Nature's Protest,963754730,46,0,0,kNormalHit,Demo,Dragaryle
20260909-22:06:08:288,DamageDone,Basic Shot,947551927,833,0,0,kNormalHit,Demo,Ramux
20260909-22:06:08:395,DamageDone,Deadly Viper,940584840,12,0,0,kNormalHit,Demo,Ramux
20260909-22:06:08:396,DamageDone,Storm Current,952531070,522,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:08:516,DamageDone,Basic Shot,947523317,3337,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:08:646,DamageDone,Deadly Viper,940584840,16,0,0,kNormalHit,Demo,Ramux
20260909-22:06:08:646,DamageDone,Storm Current,952531070,590,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:08:809,DamageDone,Mother Nature's Protest,963754730,617,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:09:002,DamageDone,Mother Nature's Protest,963754730,597,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:09:541,DamageDone,Basic Shot,947551927,1564,0,1,kNormalHit,Demo,Ramux
20260909-22:06:09:648,DamageDone,Deadly Viper,940584840,181,0,0,kNormalHit,Demo,Ramux
20260909-22:06:09:649,DamageDone,Deadly Viper,940584840,3,0,0,kNormalHit,Demo,Ramux
20260909-22:06:09:649,DamageDone,Storm Current,952531070,735,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:09:982,DamageDone,Basic Shot,947523317,2064,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:09:982,DamageDone,Mother Nature's Protest,963754730,9,0,0,kNormalHit,Demo,Ramux
20260909-22:06:10:021,DamageDone,Detonation Mark,953174691,14109,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:10:057,DamageDone,Detonation Mark,953174691,5342,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:10:057,DamageDone,Mother Nature's Protest,963754730,1,0,0,kNormalHit,Demo,Ramux
20260909-22:06:10:058,DamageDone,Mother Nature's Protest,963754730,355,0,1,kNormalHit,Demo,Ramux
20260909-22:06:10:098,DamageDone,Deadly Viper,940584840,199,0,0,kNormalHit,Demo,Ramux
20260909-22:06:10:099,DamageDone,Storm Current,952531070,171,0,0,kNormalHit,Demo,Ramux
20260909-22:06:10:139,DamageDone,Deadly Viper,940584840,11,0,0,kNormalHit,Demo,Ramux
20260909-22:06:10:139,DamageDone,Storm Current,952531070,304,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:10:139,DamageDone,Deadly Viper,940584840,9,0,0,kNormalHit,Demo,Ramux
20260909-22:06:10:140,DamageDone,Storm Current,952531070,304,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:10:439,DamageDone,Basic Shot,947457802,4692,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:10:439,DamageDone,Mother Nature's Protest,963754730,263,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:10:439,DamageDone,Mother Nature's Protest,963754730,7,0,0,kNormalHit,Demo,Ramux
20260909-22:06:10:476,DamageDone,Mother Nature's Protest,963754730,126,0,0,kNormalHit,Demo,Ramux
20260909-22:06:10:476,DamageDone,Mother Nature's Protest,963754730,2,0,0,kNormalHit,Demo,Ramux
20260909-22:06:10:515,DamageDone,Mother Nature's Protest,963754730,249,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:10:515,DamageDone,Mother Nature's Protest,963754730,2,0,0,kNormalHit,Demo,Ramux
20260909-22:06:10:516,DamageDone,Deadly Viper,940584840,321,0,0,kNormalHit,Demo,Ramux
20260909-22:06:10:517,DamageDone,Storm Current,952531070,302,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:10:629,DamageDone,Ensnaring Arrow,963973967,4094,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:10:702,DamageDone,Deadly Viper,940584840,51,0,0,kNormalHit,Demo,Ramux
20260909-22:06:10:704,DamageDone,Storm Current,952531070,790,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:10:890,DamageDone,Mother Nature's Protest,963754730,783,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:10:890,DamageDone,Mother Nature's Protest,963754730,11,0,0,kNormalHit,Demo,Ramux
20260909-22:06:10:928,DamageDone,Quick Fire,964762401,11059,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:10:965,DamageDone,Quick Fire,964762401,25612,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:000,DamageDone,Deadly Viper,940584840,76,0,0,kNormalHit,Demo,Ramux
20260909-22:06:11:000,DamageDone,Storm Current,952531070,340,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:038,DamageDone,Quick Fire,964762401,28542,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:038,DamageDone,Deadly Viper,940584840,35,0,0,kNormalHit,Demo,Ramux
20260909-22:06:11:038,DamageDone,Storm Current,952531070,340,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:069,DamageDone,Mother Nature's Protest,963754730,779,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:069,DamageDone,Mother Nature's Protest,963754730,36,0,0,kNormalHit,Demo,Ramux
20260909-22:06:11:104,DamageDone,Storm Current,952531070,965,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:104,DamageDone,Deadly Viper,940584840,17,0,0,kNormalHit,Demo,Ramux
20260909-22:06:11:140,DamageDone,Quick Fire,964762401,34974,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:215,DamageDone,Deadly Viper,940584840,137,0,0,kNormalHit,Demo,Ramux
20260909-22:06:11:215,DamageDone,Storm Current,952531070,134,0,0,kNormalHit,Demo,Ramux
20260909-22:06:11:327,DamageDone,Mother Nature's Protest,963754730,329,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:327,DamageDone,Mother Nature's Protest,963754730,48,0,0,kNormalHit,Demo,Ramux
20260909-22:06:11:400,DamageDone,Mother Nature's Protest,963754730,879,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:400,DamageDone,Mother Nature's Protest,963754730,927,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:400,DamageDone,Mother Nature's Protest,963754730,26,0,0,kNormalHit,Demo,Ramux
20260909-22:06:11:477,DamageDone,Mother Nature's Protest,963754730,918,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:477,DamageDone,Mother Nature's Protest,963754730,19,0,0,kNormalHit,Demo,Ramux
20260909-22:06:11:618,DamageDone,Basic Shot,947523317,6912,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:728,DamageDone,Deadly Viper,940584840,143,0,0,kNormalHit,Demo,Ramux
20260909-22:06:11:728,DamageDone,Storm Current,952531070,1056,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:983,DamageDone,Mother Nature's Protest,963754730,925,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:11:984,DamageDone,Mother Nature's Protest,963754730,168,0,0,kNormalHit,Demo,Ramux
20260909-22:06:12:861,DamageDone,Deadly Viper,940584840,993,0,0,kNormalHit,Demo,Ramux
20260909-22:06:13:001,DamageDone,Mother Nature's Protest,963754730,361,0,0,kNormalHit,Demo,Ramux
20260909-22:06:13:002,DamageDone,Decisive Sniping,964631505,811799,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:067,DamageDone,Storm Current,952531070,376,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:067,DamageDone,Deadly Viper,940584840,206,0,0,kNormalHit,Demo,Ramux
20260909-22:06:13:334,DamageDone,Mother Nature's Protest,963754730,329,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:334,DamageDone,Mother Nature's Protest,963754730,114,0,0,kNormalHit,Demo,Ramux
20260909-22:06:13:448,DamageDone,Basic Shot,947551927,1373,0,0,kNormalHit,Demo,Ramux
20260909-22:06:13:562,DamageDone,Deadly Viper,940584840,874,0,0,kNormalHit,Demo,Ramux
20260909-22:06:13:563,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:832,DamageDone,Detonation Mark,953174691,202854,0,0,kNormalHit,Demo,Ramux
20260909-22:06:13:832,DamageDone,Mother Nature's Protest,963754730,943,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:832,DamageDone,Mother Nature's Protest,963754730,64,0,0,kNormalHit,Demo,Ramux
20260909-22:06:13:832,DamageDone,Decisive Sniping,964631505,58868,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:832,DamageDone,Decisive Sniping,964631505,58868,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:832,DamageDone,Decisive Sniping,964631505,58868,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:907,DamageDone,Deadly Viper,940584840,596,0,0,kNormalHit,Demo,Ramux
20260909-22:06:13:907,DamageDone,Storm Current,952531070,1083,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:907,DamageDone,Storm Current,952531070,1083,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:907,DamageDone,Storm Current,952531070,1083,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:993,DamageDone,Deadly Viper,940584840,32,0,0,kNormalHit,Demo,Ramux
20260909-22:06:13:993,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:993,DamageDone,Basic Shot,947523317,6002,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:993,DamageDone,Decisive Sniping,964631505,58868,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:993,DamageDone,Decisive Sniping,964631505,58868,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:993,DamageDone,Decisive Sniping,964631505,65704,0,1,kNormalHit,Demo,Ramux
20260909-22:06:13:993,DamageDone,Deadly Viper,940584840,98,0,0,kNormalHit,Demo,Ramux
20260909-22:06:13:993,DamageDone,Storm Current,952531070,1083,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:993,DamageDone,Storm Current,952531070,1083,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:13:993,DamageDone,Storm Current,952531070,335,0,1,kNormalHit,Demo,Ramux
20260909-22:06:14:070,DamageDone,Decisive Sniping,964631505,165592,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:070,DamageDone,Decisive Sniping,964631505,16209,0,0,kNormalHit,Demo,Ramux
20260909-22:06:14:070,DamageDone,Decisive Sniping,964631505,58868,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:070,DamageDone,Deadly Viper,940584840,85,0,0,kNormalHit,Demo,Ramux
20260909-22:06:14:070,DamageDone,Storm Current,952531070,122,0,0,kNormalHit,Demo,Ramux
20260909-22:06:14:070,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:070,DamageDone,Storm Current,952531070,1083,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:147,DamageDone,Deadly Viper,940584840,40,0,0,kNormalHit,Demo,Ramux
20260909-22:06:14:147,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:147,DamageDone,Decisive Sniping,964631505,165592,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:147,DamageDone,Decisive Sniping,964631505,58868,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:147,DamageDone,Decisive Sniping,964631505,58868,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:147,DamageDone,Decisive Sniping,964631505,92506,0,1,kNormalHit,Demo,Ramux
20260909-22:06:14:147,DamageDone,Decisive Sniping,964631505,58868,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:147,DamageDone,Decisive Sniping,964631505,58868,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:181,DamageDone,Deadly Viper,940584840,172,0,0,kNormalHit,Demo,Ramux
20260909-22:06:14:181,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:181,DamageDone,Storm Current,952531070,1083,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:181,DamageDone,Storm Current,952531070,1083,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:219,DamageDone,Decisive Sniping,964631505,165592,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:219,DamageDone,Decisive Sniping,964631505,58868,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:219,DamageDone,Decisive Sniping,964631505,58868,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:219,DamageDone,Deadly Viper,940584840,61,0,0,kNormalHit,Demo,Ramux
20260909-22:06:14:219,DamageDone,Storm Current,952531070,1083,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:219,DamageDone,Storm Current,952531070,539,0,1,kNormalHit,Demo,Ramux
20260909-22:06:14:219,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:298,DamageDone,Mother Nature's Protest,963754730,894,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:299,DamageDone,Deadly Viper,940584840,172,0,0,kNormalHit,Demo,Ramux
20260909-22:06:14:299,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:299,DamageDone,Storm Current,952531070,1083,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:299,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:374,DamageDone,Decisive Sniping,964631505,36610,0,1,kNormalHit,Demo,Ramux
20260909-22:06:14:374,DamageDone,Decisive Sniping,964631505,165592,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:374,DamageDone,Decisive Sniping,964631505,165592,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:374,DamageDone,Mother Nature's Protest,963754730,178,0,0,kNormalHit,Demo,Ramux
20260909-22:06:14:374,DamageDone,Mother Nature's Protest,963754730,189,0,0,kNormalHit,Demo,Ramux
20260909-22:06:14:374,DamageDone,Deadly Viper,940584840,97,0,0,kNormalHit,Demo,Ramux
20260909-22:06:14:374,DamageDone,Storm Current,952531070,1083,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:374,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:14:374,DamageDone,Storm Current,952531070,72,0,0,kNormalHit,Demo,Ramux
20260909-22:06:15:414,DamageDone,Mother Nature's Protest,963754730,126,0,0,kNormalHit,Demo,Ramux
20260909-22:06:15:448,DamageDone,Deadly Viper,940584840,1386,0,0,kNormalHit,Demo,Ramux
20260909-22:06:15:725,DamageDone,Decisive Sniping,964631505,291046,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:15:866,DamageDone,Deadly Viper,940584840,510,0,0,kNormalHit,Demo,Ramux
20260909-22:06:15:866,DamageDone,Storm Current,952531070,387,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:011,DamageDone,Basic Shot,947551927,2232,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:151,DamageDone,Mother Nature's Protest,963754730,271,0,1,kNormalHit,Demo,Ramux
20260909-22:06:16:151,DamageDone,Mother Nature's Protest,963754730,101,0,0,kNormalHit,Demo,Ramux
20260909-22:06:16:220,DamageDone,Deadly Viper,940584840,452,0,0,kNormalHit,Demo,Ramux
20260909-22:06:16:220,DamageDone,Storm Current,952531070,387,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:373,DamageDone,Basic Shot,947523317,2218,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:445,DamageDone,Deadly Viper,940584840,369,0,0,kNormalHit,Demo,Ramux
20260909-22:06:16:445,DamageDone,Storm Current,952531070,1007,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:512,DamageDone,Decisive Sniping,964631505,151047,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:512,DamageDone,Decisive Sniping,964631505,151047,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:512,DamageDone,Decisive Sniping,964631505,151047,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:513,DamageDone,Deadly Viper,940584840,160,0,0,kNormalHit,Demo,Ramux
20260909-22:06:16:513,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:513,DamageDone,Storm Current,952531070,1005,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:513,DamageDone,Storm Current,952531070,1005,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:513,DamageDone,Decisive Sniping,964631505,150787,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:513,DamageDone,Decisive Sniping,964631505,57699,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:513,DamageDone,Decisive Sniping,964631505,150787,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:713,DamageDone,Mother Nature's Protest,963754730,334,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:713,DamageDone,Mother Nature's Protest,963754730,80,0,0,kNormalHit,Demo,Ramux
20260909-22:06:16:713,DamageDone,Deadly Viper,940584840,371,0,0,kNormalHit,Demo,Ramux
20260909-22:06:16:714,DamageDone,Storm Current,952531070,294,0,1,kNormalHit,Demo,Ramux
20260909-22:06:16:714,DamageDone,Storm Current,952531070,383,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:714,DamageDone,Storm Current,952531070,927,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:714,DamageDone,Ensnaring Arrow,963973967,5047,0,1,kNormalHit,Demo,Ramux
20260909-22:06:16:714,DamageDone,Decisive Sniping,964631505,150921,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:714,DamageDone,Decisive Sniping,964631505,150921,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:714,DamageDone,Decisive Sniping,964631505,150921,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:714,DamageDone,Deadly Viper,940584840,101,0,0,kNormalHit,Demo,Ramux
20260909-22:06:16:714,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:814,DamageDone,Decisive Sniping,964631505,57751,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:814,DamageDone,Decisive Sniping,964631505,57751,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:814,DamageDone,Decisive Sniping,964631505,57751,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:814,DamageDone,Mother Nature's Protest,963754730,304,0,1,kNormalHit,Demo,Ramux
20260909-22:06:16:814,DamageDone,Mother Nature's Protest,963754730,72,0,0,kNormalHit,Demo,Ramux
20260909-22:06:16:814,DamageDone,Deadly Viper,940584840,85,0,0,kNormalHit,Demo,Ramux
20260909-22:06:16:814,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:814,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:814,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:876,DamageDone,Deadly Viper,940584840,80,0,0,kNormalHit,Demo,Ramux
20260909-22:06:16:876,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:876,DamageDone,Storm Current,952531070,1006,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:876,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:876,DamageDone,Decisive Sniping,964631505,57792,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:876,DamageDone,Decisive Sniping,964631505,151032,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:876,DamageDone,Decisive Sniping,964631505,151032,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:947,DamageDone,Deadly Viper,940584840,104,0,0,kNormalHit,Demo,Ramux
20260909-22:06:16:947,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:947,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:947,DamageDone,Storm Current,952531070,1005,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:947,DamageDone,Decisive Sniping,964631505,150915,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:947,DamageDone,Decisive Sniping,964631505,150915,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:947,DamageDone,Decisive Sniping,964631505,57748,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:947,DamageDone,Deadly Viper,940584840,26,0,0,kNormalHit,Demo,Ramux
20260909-22:06:16:947,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:947,DamageDone,Storm Current,952531070,1005,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:16:947,DamageDone,Storm Current,952531070,384,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:17:011,DamageDone,Mother Nature's Protest,963754730,875,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:17:011,DamageDone,Mother Nature's Protest,963754730,40,0,0,kNormalHit,Demo,Ramux
20260909-22:06:17:012,DamageDone,Decisive Sniping,964631505,19399,0,0,kNormalHit,Demo,Ramux
20260909-22:06:17:012,DamageDone,Decisive Sniping,964631505,23132,0,0,kNormalHit,Demo,Ramux
20260909-22:06:17:012,DamageDone,Decisive Sniping,964631505,150915,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:17:281,DamageDone,Deadly Viper,940584840,485,0,0,kNormalHit,Demo,Ramux
20260909-22:06:17:281,DamageDone,Storm Current,952531070,325,0,1,kNormalHit,Demo,Ramux
20260909-22:06:17:281,DamageDone,Storm Current,952531070,293,0,1,kNormalHit,Demo,Ramux
20260909-22:06:17:281,DamageDone,Storm Current,952531070,1005,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:17:281,DamageDone,Detonation Mark,953174691,19455,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:17:281,DamageDone,Detonation Mark,953174691,6518,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:17:282,DamageDone,Detonation Mark,953174691,2178,0,0,kNormalHit,Demo,Ramux
20260909-22:06:17:348,DamageDone,Deadly Viper,940584840,116,0,0,kNormalHit,Demo,Ramux
20260909-22:06:17:349,DamageDone,Deadly Viper,940584840,20,0,0,kNormalHit,Demo,Ramux
20260909-22:06:17:349,DamageDone,Deadly Viper,940584840,53,0,0,kNormalHit,Demo,Ramux
20260909-22:06:17:735,DamageDone,Mother Nature's Protest,963754730,875,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:17:735,DamageDone,Mother Nature's Protest,963754730,875,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:17:736,DamageDone,Mother Nature's Protest,963754730,830,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:17:736,DamageDone,Mother Nature's Protest,963754730,126,0,0,kNormalHit,Demo,Ramux
20260909-22:06:18:498,DamageDone,Deadly Viper,940584840,1337,0,0,kNormalHit,Demo,Ramux
20260909-22:06:18:724,DamageDone,Mother Nature's Protest,963754730,334,0,0,kNormalHit,Demo,Ramux
20260909-22:06:19:372,DamageDone,Deadly Viper,940584840,1076,0,0,kNormalHit,Demo,Ramux
20260909-22:06:19:637,DamageDone,Decisive Sniping,964500434,293499,0,1,kNormalHit,Demo,Ramux
20260909-22:06:19:637,DamageDone,Deadly Viper,940584840,321,0,0,kNormalHit,Demo,Ramux
20260909-22:06:19:638,DamageDone,Mother Nature's Protest,963754730,298,0,0,kNormalHit,Demo,Ramux
20260909-22:06:19:788,DamageDone,Basic Shot,947551927,573,0,0,kNormalHit,Demo,Ramux
20260909-22:06:19:821,DamageDone,Deadly Viper,940584840,713,0,0,kNormalHit,Demo,Ramux
20260909-22:06:19:821,DamageDone,Storm Current,952531070,975,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:19:942,DamageDone,Mother Nature's Protest,963754730,853,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:19:942,DamageDone,Mother Nature's Protest,963754730,94,0,0,kNormalHit,Demo,Ramux
20260909-22:06:20:063,DamageDone,Basic Shot,947523317,5112,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:157,DamageDone,Mother Nature's Protest,963754730,959,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:157,DamageDone,Mother Nature's Protest,963754730,45,0,0,kNormalHit,Demo,Ramux
20260909-22:06:20:268,DamageDone,Storm Current,952531070,120,0,0,kNormalHit,Demo,Ramux
20260909-22:06:20:268,DamageDone,Decisive Sniping,964500434,61884,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:268,DamageDone,Decisive Sniping,964500434,161740,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:268,DamageDone,Decisive Sniping,964500434,161740,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:268,DamageDone,Storm Current,952531070,420,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:268,DamageDone,Storm Current,952531070,201,0,1,kNormalHit,Demo,Ramux
20260909-22:06:20:268,DamageDone,Storm Current,952531070,1102,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:331,DamageDone,Decisive Sniping,964500434,161740,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:332,DamageDone,Decisive Sniping,964500434,79568,0,1,kNormalHit,Demo,Ramux
20260909-22:06:20:332,DamageDone,Decisive Sniping,964500434,61884,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:332,DamageDone,Storm Current,952531070,471,0,1,kNormalHit,Demo,Ramux
20260909-22:06:20:332,DamageDone,Storm Current,952531070,1102,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:332,DamageDone,Storm Current,952531070,420,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:393,DamageDone,Decisive Sniping,964500434,80766,0,1,kNormalHit,Demo,Ramux
20260909-22:06:20:455,DamageDone,Decisive Sniping,964500434,161740,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:455,DamageDone,Decisive Sniping,964500434,161740,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:455,DamageDone,Storm Current,952531070,420,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:455,DamageDone,Storm Current,952531070,420,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:455,DamageDone,Storm Current,952531070,420,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:455,DamageDone,Blade Storm,945408027,10007,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:487,DamageDone,Mother Nature's Protest,963754730,959,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:487,DamageDone,Mother Nature's Protest,963754730,60,0,0,kNormalHit,Demo,Ramux
20260909-22:06:20:487,DamageDone,Storm Current,952531070,205,0,1,kNormalHit,Demo,Ramux
20260909-22:06:20:515,DamageDone,Blade Storm,945408027,5119,0,1,kNormalHit,Demo,Ramux
20260909-22:06:20:516,DamageDone,Decisive Sniping,964500434,161740,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:516,DamageDone,Decisive Sniping,964500434,161740,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:516,DamageDone,Decisive Sniping,964500434,161740,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:580,DamageDone,Storm Current,952531070,209,0,0,kNormalHit,Demo,Ramux
20260909-22:06:20:580,DamageDone,Storm Current,952531070,388,0,1,kNormalHit,Demo,Ramux
20260909-22:06:20:580,DamageDone,Storm Current,952531070,1102,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:580,DamageDone,Storm Current,952531070,1102,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:645,DamageDone,Blade Storm,945408027,4460,0,1,kNormalHit,Demo,Ramux
20260909-22:06:20:675,DamageDone,Decisive Sniping,964500434,62366,0,1,kNormalHit,Demo,Ramux
20260909-22:06:20:675,DamageDone,Decisive Sniping,964500434,161740,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:675,DamageDone,Decisive Sniping,964500434,16465,0,0,kNormalHit,Demo,Ramux
20260909-22:06:20:708,DamageDone,Blade Storm,945408027,3904,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:708,DamageDone,Storm Current,952531070,525,0,1,kNormalHit,Demo,Ramux
20260909-22:06:20:708,DamageDone,Storm Current,952531070,1102,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:708,DamageDone,Storm Current,952531070,420,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:708,DamageDone,Storm Current,952531070,1102,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:771,DamageDone,Decisive Sniping,964500434,161740,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:771,DamageDone,Decisive Sniping,964500434,161740,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:771,DamageDone,Decisive Sniping,964500434,61884,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:771,DamageDone,Storm Current,952531070,420,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:771,DamageDone,Storm Current,952531070,420,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:771,DamageDone,Storm Current,952531070,1102,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:802,DamageDone,Storm Current,952531070,1102,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:802,DamageDone,Mother Nature's Protest,963754730,959,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:802,DamageDone,Mother Nature's Protest,963754730,107,0,0,kNormalHit,Demo,Ramux
20260909-22:06:20:802,DamageDone,Blade Storm,945408027,3904,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:835,DamageDone,Storm Current,952531070,420,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:866,DamageDone,Deadly Viper,940584840,1867,0,0,kNormalHit,Demo,Ramux
20260909-22:06:20:866,DamageDone,Mother Nature's Protest,963754730,959,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:866,DamageDone,Mother Nature's Protest,963754730,13,0,0,kNormalHit,Demo,Ramux
20260909-22:06:20:866,DamageDone,Basic Shot,947457802,3087,0,1,kNormalHit,Demo,Ramux
20260909-22:06:20:866,DamageDone,Decisive Sniping,964500434,161740,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:866,DamageDone,Decisive Sniping,964500434,161740,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:866,DamageDone,Decisive Sniping,964500434,61884,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:900,DamageDone,Storm Current,952531070,222,0,0,kNormalHit,Demo,Ramux
20260909-22:06:20:900,DamageDone,Storm Current,952531070,1102,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:20:900,DamageDone,Storm Current,952531070,1102,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:21:034,DamageDone,Storm Current,952531070,1102,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:21:034,DamageDone,Mother Nature's Protest,963754730,959,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:21:034,DamageDone,Mother Nature's Protest,963754730,24,0,0,kNormalHit,Demo,Ramux
20260909-22:06:21:095,DamageDone,Mother Nature's Protest,963754730,959,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:21:129,DamageDone,Mother Nature's Protest,963754730,854,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:21:129,DamageDone,Mother Nature's Protest,963754730,8,0,0,kNormalHit,Demo,Ramux
20260909-22:06:21:259,DamageDone,Mother Nature's Protest,963754730,854,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:21:260,DamageDone,Mother Nature's Protest,963754730,50,0,0,kNormalHit,Demo,Ramux
20260909-22:06:21:870,DamageDone,Deadly Viper,940584840,1812,0,0,kNormalHit,Demo,Ramux
20260909-22:06:21:928,DamageDone,Detonation Mark,953174691,215328,0,0,kNormalHit,Demo,Ramux
20260909-22:06:22:080,DamageDone,Storm Current,952531070,482,0,1,kNormalHit,Demo,Ramux
20260909-22:06:22:254,DamageDone,Mother Nature's Protest,963754730,192,0,0,kNormalHit,Demo,Ramux
20260909-22:06:22:314,DamageDone,Mother Nature's Protest,963754730,309,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:22:314,DamageDone,Mother Nature's Protest,963754730,12,0,0,kNormalHit,Demo,Ramux
20260909-22:06:22:341,DamageDone,Decisive Sniping,964631505,55122,0,0,kNormalHit,Demo,Ramux
20260909-22:06:22:372,DamageDone,Storm Current,952531070,374,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:22:654,DamageDone,Mother Nature's Protest,963754730,326,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:22:654,DamageDone,Roxie's Arrowhead,947532344,11511,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:22:654,DamageDone,Mother Nature's Protest,963754730,38,0,0,kNormalHit,Demo,Ramux
20260909-22:06:22:685,DamageDone,Basic Shot,947551927,4864,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:22:776,DamageDone,Storm Current,952531070,375,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:22:865,DamageDone,Deadly Viper,940584840,1757,0,0,kNormalHit,Demo,Ramux
20260909-22:06:22:924,DamageDone,Basic Shot,947523317,4864,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:062,DamageDone,Storm Current,952531070,375,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:063,DamageDone,Mother Nature's Protest,963754730,483,0,1,kNormalHit,Demo,Ramux
20260909-22:06:23:092,DamageDone,Mother Nature's Protest,963754730,136,0,0,kNormalHit,Demo,Ramux
20260909-22:06:23:092,DamageDone,Decisive Sniping,964631505,49477,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:092,DamageDone,Decisive Sniping,964631505,129273,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:092,DamageDone,Decisive Sniping,964631505,49477,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:092,DamageDone,Storm Current,952531070,241,0,1,kNormalHit,Demo,Ramux
20260909-22:06:23:092,DamageDone,Storm Current,952531070,981,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:092,DamageDone,Storm Current,952531070,375,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:206,DamageDone,Decisive Sniping,964631505,12276,0,0,kNormalHit,Demo,Ramux
20260909-22:06:23:206,DamageDone,Decisive Sniping,964631505,129273,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:206,DamageDone,Decisive Sniping,964631505,129273,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:232,DamageDone,Storm Current,952531070,906,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:232,DamageDone,Storm Current,952531070,111,0,0,kNormalHit,Demo,Ramux
20260909-22:06:23:232,DamageDone,Storm Current,952531070,375,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:315,DamageDone,Decisive Sniping,964631505,50738,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:315,DamageDone,Decisive Sniping,964631505,50738,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:315,DamageDone,Decisive Sniping,964631505,132570,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:342,DamageDone,Mother Nature's Protest,963754730,492,0,1,kNormalHit,Demo,Ramux
20260909-22:06:23:342,DamageDone,Mother Nature's Protest,963754730,20,0,0,kNormalHit,Demo,Ramux
20260909-22:06:23:399,DamageDone,Decisive Sniping,964631505,132570,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:399,DamageDone,Decisive Sniping,964631505,50738,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:399,DamageDone,Decisive Sniping,964631505,50738,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:513,DamageDone,Decisive Sniping,964631505,50738,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:513,DamageDone,Decisive Sniping,964631505,50738,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:513,DamageDone,Decisive Sniping,964631505,132570,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:622,DamageDone,Decisive Sniping,964631505,50738,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:622,DamageDone,Decisive Sniping,964631505,50738,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:622,DamageDone,Decisive Sniping,964631505,132570,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:760,DamageDone,Decisive Sniping,964631505,132570,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:760,DamageDone,Decisive Sniping,964631505,132570,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:23:760,DamageDone,Decisive Sniping,964631505,15136,0,0,kNormalHit,Demo,Ramux
20260909-22:06:23:839,DamageDone,Deadly Viper,940584840,1812,0,0,kNormalHit,Demo,Ramux
20260909-22:06:24:333,DamageDone,Mother Nature's Protest,963754730,331,0,0,kNormalHit,Demo,Ramux
20260909-22:06:24:827,DamageDone,Deadly Viper,940584840,1827,0,0,kNormalHit,Demo,Ramux
20260909-22:06:25:364,DamageDone,Mother Nature's Protest,963754730,332,0,0,kNormalHit,Demo,Ramux
20260909-22:06:25:827,DamageDone,Deadly Viper,940584840,1577,0,0,kNormalHit,Demo,Ramux
20260909-22:06:25:885,DamageDone,Ensnaring Arrow,963973967,2165,0,1,kNormalHit,Demo,Ramux
20260909-22:06:26:150,DamageDone,Basic Shot,947523317,1361,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:26:209,DamageDone,Mother Nature's Protest,963754730,250,0,0,kNormalHit,Demo,Ramux
20260909-22:06:26:209,DamageDone,Mother Nature's Protest,963754730,60,0,0,kNormalHit,Demo,Ramux
20260909-22:06:26:209,DamageDone,Roxie's Arrowhead,947532344,3522,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:26:512,DamageDone,Mother Nature's Protest,963754730,266,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:26:512,DamageDone,Mother Nature's Protest,963754730,30,0,0,kNormalHit,Demo,Ramux
20260909-22:06:26:697,DamageDone,Detonation Mark,953371309,14266,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:26:849,DamageDone,Deadly Viper,940584840,1699,0,0,kNormalHit,Demo,Ramux
20260909-22:06:27:036,DamageDone,Mother Nature's Protest,963754730,750,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:036,DamageDone,Mother Nature's Protest,963754730,53,0,0,kNormalHit,Demo,Ramux
20260909-22:06:27:394,DamageDone,Deadly Viper,940584840,928,0,0,kNormalHit,Demo,Ramux
20260909-22:06:27:451,DamageDone,Deadly Viper,940584840,105,0,0,kNormalHit,Demo,Ramux
20260909-22:06:27:595,DamageDone,Blade Storm,945710601,2811,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:595,DamageDone,Blade Storm,945710601,2811,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:682,DamageDone,Blade Storm,945710601,7771,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:682,DamageDone,Blade Storm,945710601,2811,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:803,DamageDone,Blade Storm,945710601,2811,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:803,DamageDone,Blade Storm,945710601,7771,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:867,DamageDone,Basic Shot,947523317,1733,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:868,DamageDone,Mother Nature's Protest,963754730,266,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:868,DamageDone,Mother Nature's Protest,963754730,251,0,1,kNormalHit,Demo,Ramux
20260909-22:06:27:868,DamageDone,Mother Nature's Protest,963754730,235,0,0,kNormalHit,Demo,Ramux
20260909-22:06:27:930,DamageDone,Blade Storm,945710601,7775,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:930,DamageDone,Blade Storm,945710601,7775,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:991,DamageDone,Blade Storm,945710601,7775,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:991,DamageDone,Blade Storm,945710601,2813,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:992,DamageDone,Mother Nature's Protest,963754730,751,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:992,DamageDone,Mother Nature's Protest,963754730,266,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:27:992,DamageDone,Mother Nature's Protest,963754730,35,0,0,kNormalHit,Demo,Ramux
20260909-22:06:28:091,DamageDone,Mother Nature's Protest,963754730,393,0,1,kNormalHit,Demo,Ramux
20260909-22:06:28:091,DamageDone,Mother Nature's Protest,963754730,266,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:28:091,DamageDone,Mother Nature's Protest,963754730,26,0,0,kNormalHit,Demo,Ramux
20260909-22:06:28:221,DamageDone,Mother Nature's Protest,963754730,126,0,1,kNormalHit,Demo,Ramux
20260909-22:06:28:222,DamageDone,Mother Nature's Protest,963754730,267,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:28:222,DamageDone,Mother Nature's Protest,963754730,9,0,0,kNormalHit,Demo,Ramux
20260909-22:06:28:222,DamageDone,Roxie's Arrowhead,947532344,3795,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:28:222,DamageDone,Mother Nature's Protest,963754730,267,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:28:222,DamageDone,Mother Nature's Protest,963754730,3,0,0,kNormalHit,Demo,Ramux
20260909-22:06:28:284,DamageDone,Basic Shot,947457802,1699,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:28:316,DamageDone,Mother Nature's Protest,963754730,797,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:28:316,DamageDone,Mother Nature's Protest,963754730,428,0,1,kNormalHit,Demo,Ramux
20260909-22:06:28:316,DamageDone,Mother Nature's Protest,963754730,22,0,0,kNormalHit,Demo,Ramux
20260909-22:06:28:716,DamageDone,Mother Nature's Protest,963754730,791,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:28:716,DamageDone,Mother Nature's Protest,963754730,117,0,0,kNormalHit,Demo,Ramux
20260909-22:06:29:698,DamageDone,Mother Nature's Protest,963754730,300,0,0,kNormalHit,Demo,Ramux
20260909-22:06:30:302,DamageDone,Decisive Sniping,964500434,663570,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:30:510,DamageDone,Detonation Mark,953371309,91066,0,0,kNormalHit,Demo,Ramux
20260909-22:06:30:661,DamageDone,Mother Nature's Protest,963754730,853,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:30:661,DamageDone,Basic Shot,947551927,2100,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:30:754,DamageDone,Mother Nature's Protest,963754730,332,0,0,kNormalHit,Demo,Ramux
20260909-22:06:30:789,DamageDone,Storm Current,952531070,980,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:30:884,DamageDone,Mother Nature's Protest,963754730,327,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:30:946,DamageDone,Basic Shot,947523317,5363,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:042,DamageDone,Storm Current,952531070,376,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:043,DamageDone,Decisive Sniping,964500434,29908,0,0,kNormalHit,Demo,Ramux
20260909-22:06:31:043,DamageDone,Decisive Sniping,964500434,17916,0,0,kNormalHit,Demo,Ramux
20260909-22:06:31:043,DamageDone,Decisive Sniping,964500434,51925,0,1,kNormalHit,Demo,Ramux
20260909-22:06:31:043,DamageDone,Mother Nature's Protest,963754730,106,0,0,kNormalHit,Demo,Ramux
20260909-22:06:31:043,DamageDone,Mother Nature's Protest,963754730,368,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:043,DamageDone,Storm Current,952531070,422,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:043,DamageDone,Storm Current,952531070,289,0,1,kNormalHit,Demo,Ramux
20260909-22:06:31:043,DamageDone,Storm Current,952531070,422,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:162,DamageDone,Decisive Sniping,964500434,153652,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:162,DamageDone,Decisive Sniping,964500434,40590,0,1,kNormalHit,Demo,Ramux
20260909-22:06:31:162,DamageDone,Decisive Sniping,964500434,58793,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:162,DamageDone,Storm Current,952531070,477,0,1,kNormalHit,Demo,Ramux
20260909-22:06:31:162,DamageDone,Storm Current,952531070,1133,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:163,DamageDone,Storm Current,952531070,1133,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:262,DamageDone,Decisive Sniping,964500434,29311,0,0,kNormalHit,Demo,Ramux
20260909-22:06:31:262,DamageDone,Decisive Sniping,964500434,52129,0,1,kNormalHit,Demo,Ramux
20260909-22:06:31:262,DamageDone,Decisive Sniping,964500434,58793,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:291,DamageDone,Storm Current,952531070,433,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:291,DamageDone,Storm Current,952531070,433,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:291,DamageDone,Storm Current,952531070,1133,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:353,DamageDone,Roxie's Arrowhead,947532344,3422,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:353,DamageDone,Mother Nature's Protest,963754730,464,0,1,kNormalHit,Demo,Ramux
20260909-22:06:31:353,DamageDone,Mother Nature's Protest,963754730,39,0,0,kNormalHit,Demo,Ramux
20260909-22:06:31:382,DamageDone,Decisive Sniping,964500434,58793,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:382,DamageDone,Decisive Sniping,964500434,153652,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:382,DamageDone,Decisive Sniping,964500434,153652,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:411,DamageDone,Storm Current,952531070,1047,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:411,DamageDone,Storm Current,952531070,1133,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:411,DamageDone,Storm Current,952531070,1133,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:499,DamageDone,Decisive Sniping,964500434,58793,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:499,DamageDone,Decisive Sniping,964500434,58793,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:499,DamageDone,Decisive Sniping,964500434,153652,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:529,DamageDone,Storm Current,952531070,433,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:529,DamageDone,Storm Current,952531070,1133,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:529,DamageDone,Storm Current,952531070,1133,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:592,DamageDone,Basic Shot,947457802,2397,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:623,DamageDone,Decisive Sniping,964500434,58793,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:623,DamageDone,Decisive Sniping,964500434,153652,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:623,DamageDone,Decisive Sniping,964500434,153652,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:655,DamageDone,Storm Current,952531070,66,0,0,kNormalHit,Demo,Ramux
20260909-22:06:31:656,DamageDone,Storm Current,952531070,1133,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:656,DamageDone,Storm Current,952531070,1133,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:656,DamageDone,Storm Current,952531070,1133,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:717,DamageDone,Decisive Sniping,964500434,153652,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:717,DamageDone,Decisive Sniping,964500434,153652,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:717,DamageDone,Decisive Sniping,964500434,58793,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:750,DamageDone,Storm Current,952531070,471,0,1,kNormalHit,Demo,Ramux
20260909-22:06:31:750,DamageDone,Storm Current,952531070,263,0,1,kNormalHit,Demo,Ramux
20260909-22:06:31:750,DamageDone,Storm Current,952531070,380,0,1,kNormalHit,Demo,Ramux
20260909-22:06:31:944,DamageDone,Ensnaring Arrow,963973967,1277,0,0,kNormalHit,Demo,Ramux
20260909-22:06:31:975,DamageDone,Mother Nature's Protest,963754730,376,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:31:975,DamageDone,Mother Nature's Protest,963754730,47,0,0,kNormalHit,Demo,Ramux
20260909-22:06:32:009,DamageDone,Storm Current,952531070,433,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:32:319,DamageDone,Roxie's Arrowhead,947532344,13092,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:32:320,DamageDone,Mother Nature's Protest,963754730,335,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:32:320,DamageDone,Mother Nature's Protest,963754730,51,0,0,kNormalHit,Demo,Ramux
20260909-22:06:33:391,DamageDone,Mother Nature's Protest,963754730,210,0,0,kNormalHit,Demo,Ramux
20260909-22:06:33:588,DamageDone,Decisive Sniping,964631505,222057,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:33:620,DamageDone,Storm Current,952531070,840,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:33:882,DamageDone,Basic Shot,947551927,916,0,0,kNormalHit,Demo,Ramux
20260909-22:06:33:946,DamageDone,Mother Nature's Protest,963754730,736,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:33:946,DamageDone,Mother Nature's Protest,963754730,105,0,0,kNormalHit,Demo,Ramux
20260909-22:06:34:011,DamageDone,Storm Current,952531070,321,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:146,DamageDone,Basic Shot,947523317,4453,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:248,DamageDone,Storm Current,952531070,364,0,1,kNormalHit,Demo,Ramux
20260909-22:06:34:322,DamageDone,Decisive Sniping,964631505,116245,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:322,DamageDone,Decisive Sniping,964631505,44500,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:322,DamageDone,Decisive Sniping,964631505,116245,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:322,DamageDone,Storm Current,952531070,220,0,1,kNormalHit,Demo,Ramux
20260909-22:06:34:322,DamageDone,Storm Current,952531070,321,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:322,DamageDone,Storm Current,952531070,321,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:322,DamageDone,Mother Nature's Protest,963754730,736,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:322,DamageDone,Mother Nature's Protest,963754730,104,0,0,kNormalHit,Demo,Ramux
20260909-22:06:34:390,DamageDone,Decisive Sniping,964631505,50711,0,1,kNormalHit,Demo,Ramux
20260909-22:06:34:390,DamageDone,Decisive Sniping,964631505,44500,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:390,DamageDone,Decisive Sniping,964631505,44500,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:390,DamageDone,Storm Current,952531070,841,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:390,DamageDone,Storm Current,952531070,146,0,0,kNormalHit,Demo,Ramux
20260909-22:06:34:390,DamageDone,Storm Current,952531070,321,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:462,DamageDone,Decisive Sniping,964631505,44500,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:462,DamageDone,Decisive Sniping,964631505,116245,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:462,DamageDone,Decisive Sniping,964631505,44500,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:496,DamageDone,Storm Current,952531070,321,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:496,DamageDone,Storm Current,952531070,321,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:496,DamageDone,Storm Current,952531070,841,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:532,DamageDone,Blade Storm,945710601,7860,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:532,DamageDone,Blade Storm,945710601,7860,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:532,DamageDone,Mother Nature's Protest,963754730,736,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:532,DamageDone,Mother Nature's Protest,963754730,24,0,0,kNormalHit,Demo,Ramux
20260909-22:06:34:607,DamageDone,Decisive Sniping,964631505,116245,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:607,DamageDone,Decisive Sniping,964631505,116245,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:607,DamageDone,Decisive Sniping,964631505,116245,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:607,DamageDone,Storm Current,952531070,177,0,0,kNormalHit,Demo,Ramux
20260909-22:06:34:607,DamageDone,Storm Current,952531070,321,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:608,DamageDone,Storm Current,952531070,321,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:608,DamageDone,Storm Current,952531070,841,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:608,DamageDone,Storm Current,952531070,841,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:642,DamageDone,Blade Storm,945710601,7860,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:642,DamageDone,Blade Storm,945710601,7860,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:714,DamageDone,Decisive Sniping,964631505,44513,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:714,DamageDone,Decisive Sniping,964631505,116280,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:714,DamageDone,Decisive Sniping,964631505,116280,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:714,DamageDone,Storm Current,952531070,321,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:715,DamageDone,Storm Current,952531070,321,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:715,DamageDone,Storm Current,952531070,841,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:715,DamageDone,Storm Current,952531070,841,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:715,DamageDone,Storm Current,952531070,841,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:747,DamageDone,Blade Storm,945710601,1787,0,0,kNormalHit,Demo,Ramux
20260909-22:06:34:747,DamageDone,Blade Storm,945710601,7835,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:816,DamageDone,Decisive Sniping,964631505,116140,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:816,DamageDone,Decisive Sniping,964631505,116140,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:816,DamageDone,Decisive Sniping,964631505,116140,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:850,DamageDone,Storm Current,952531070,776,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:850,DamageDone,Storm Current,952531070,840,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:850,DamageDone,Storm Current,952531070,321,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:850,DamageDone,Storm Current,952531070,132,0,0,kNormalHit,Demo,Ramux
20260909-22:06:34:850,DamageDone,Storm Current,952531070,106,0,0,kNormalHit,Demo,Ramux
20260909-22:06:34:850,DamageDone,Blade Storm,945710601,3075,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:850,DamageDone,Blade Storm,945710601,7835,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:882,DamageDone,Decisive Sniping,964631505,116037,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:884,DamageDone,Decisive Sniping,964631505,44421,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:884,DamageDone,Decisive Sniping,964631505,116037,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:922,DamageDone,Mother Nature's Protest,963754730,141,0,1,kNormalHit,Demo,Ramux
20260909-22:06:34:922,DamageDone,Mother Nature's Protest,963754730,280,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:922,DamageDone,Mother Nature's Protest,963754730,23,0,0,kNormalHit,Demo,Ramux
20260909-22:06:34:922,DamageDone,Storm Current,952531070,320,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:923,DamageDone,Storm Current,952531070,839,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:923,DamageDone,Storm Current,952531070,320,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:923,DamageDone,Blade Storm,945710601,4042,0,1,kNormalHit,Demo,Ramux
20260909-22:06:34:923,DamageDone,Blade Storm,945710601,7835,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:923,DamageDone,Storm Current,952531070,320,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:923,DamageDone,Storm Current,952531070,320,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:955,DamageDone,Quick Fire,964762401,15132,0,1,kNormalHit,Demo,Ramux
20260909-22:06:34:991,DamageDone,Storm Current,952531070,320,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:991,DamageDone,Storm Current,952531070,839,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:991,DamageDone,Mother Nature's Protest,963754730,111,0,0,kNormalHit,Demo,Ramux
20260909-22:06:34:991,DamageDone,Mother Nature's Protest,963754730,734,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:34:992,DamageDone,Mother Nature's Protest,963754730,9,0,0,kNormalHit,Demo,Ramux
20260909-22:06:35:061,DamageDone,Storm Current,952531070,320,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:061,DamageDone,Quick Fire,964762401,4087,0,0,kNormalHit,Demo,Ramux
20260909-22:06:35:128,DamageDone,Quick Fire,964762401,29379,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:128,DamageDone,Mother Nature's Protest,963754730,30,0,0,kNormalHit,Demo,Ramux
20260909-22:06:35:128,DamageDone,Mother Nature's Protest,963754730,735,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:128,DamageDone,Mother Nature's Protest,963754730,735,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:160,DamageDone,Storm Current,952531070,840,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:195,DamageDone,Quick Fire,964762401,29379,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:230,DamageDone,Storm Current,952531070,840,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:266,DamageDone,Mother Nature's Protest,963754730,735,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:266,DamageDone,Mother Nature's Protest,963754730,139,0,0,kNormalHit,Demo,Ramux
20260909-22:06:35:266,DamageDone,Mother Nature's Protest,963754730,280,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:266,DamageDone,Mother Nature's Protest,963754730,735,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:266,DamageDone,Mother Nature's Protest,963754730,43,0,0,kNormalHit,Demo,Ramux
20260909-22:06:35:266,DamageDone,Storm Current,952531070,840,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:339,DamageDone,Mother Nature's Protest,963754730,340,0,1,kNormalHit,Demo,Ramux
20260909-22:06:35:339,DamageDone,Mother Nature's Protest,963754730,21,0,0,kNormalHit,Demo,Ramux
20260909-22:06:35:513,DamageDone,Mother Nature's Protest,963754730,735,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:513,DamageDone,Detonation Mark,953371309,15326,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:547,DamageDone,Mother Nature's Protest,963754730,697,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:547,DamageDone,Mother Nature's Protest,963754730,56,0,0,kNormalHit,Demo,Ramux
20260909-22:06:35:580,DamageDone,Mother Nature's Protest,963754730,280,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:580,DamageDone,Mother Nature's Protest,963754730,5,0,0,kNormalHit,Demo,Ramux
20260909-22:06:35:581,DamageDone,Storm Current,952531070,99,0,0,kNormalHit,Demo,Ramux
20260909-22:06:35:926,DamageDone,Mother Nature's Protest,963754730,280,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:35:926,DamageDone,Mother Nature's Protest,963754730,37,0,0,kNormalHit,Demo,Ramux
20260909-22:06:35:962,DamageDone,Storm Current,952531070,187,0,0,kNormalHit,Demo,Ramux
20260909-22:06:36:461,DamageDone,Ensnaring Arrow,963973967,4280,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:36:531,DamageDone,Storm Current,952531070,840,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:36:795,DamageDone,Blade Storm,945408027,8011,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:36:859,DamageDone,Mother Nature's Protest,963754730,130,0,1,kNormalHit,Demo,Ramux
20260909-22:06:36:859,DamageDone,Storm Current,952531070,319,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:36:859,DamageDone,Mother Nature's Protest,963754730,256,0,0,kNormalHit,Demo,Ramux
20260909-22:06:36:859,DamageDone,Blade Storm,945408027,1798,0,0,kNormalHit,Demo,Ramux
20260909-22:06:36:929,DamageDone,Storm Current,952531070,836,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:36:962,DamageDone,Blade Storm,945408027,1159,0,0,kNormalHit,Demo,Ramux
20260909-22:06:37:028,DamageDone,Storm Current,952531070,836,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:37:059,DamageDone,Blade Storm,945408027,3142,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:37:126,DamageDone,Storm Current,952531070,836,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:37:126,DamageDone,Mother Nature's Protest,963754730,713,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:37:127,DamageDone,Mother Nature's Protest,963754730,31,0,0,kNormalHit,Demo,Ramux
20260909-22:06:37:157,DamageDone,Blade Storm,945408027,3142,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:37:226,DamageDone,Mother Nature's Protest,963754730,272,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:37:226,DamageDone,Storm Current,952531070,311,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:37:226,DamageDone,Mother Nature's Protest,963754730,29,0,0,kNormalHit,Demo,Ramux
20260909-22:06:37:348,DamageDone,Mother Nature's Protest,963754730,713,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:37:417,DamageDone,Mother Nature's Protest,963754730,713,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:37:417,DamageDone,Mother Nature's Protest,963754730,17,0,0,kNormalHit,Demo,Ramux
20260909-22:06:37:524,DamageDone,Mother Nature's Protest,963754730,30,0,0,kNormalHit,Demo,Ramux
20260909-22:06:37:525,DamageDone,Mother Nature's Protest,963754730,213,0,1,kNormalHit,Demo,Ramux
20260909-22:06:38:559,DamageDone,Mother Nature's Protest,963754730,273,0,0,kNormalHit,Demo,Ramux
20260909-22:06:38:902,DamageDone,Detonation Mark,953371309,10326,0,0,kNormalHit,Demo,Ramux
20260909-22:06:38:935,DamageDone,Decisive Sniping,964500434,612153,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:38:935,DamageDone,Storm Current,952531070,172,0,0,kNormalHit,Demo,Ramux
20260909-22:06:39:011,DamageDone,Storm Current,952531070,321,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:222,DamageDone,Mother Nature's Protest,963754730,281,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:222,DamageDone,Roxie's Arrowhead,947532344,4188,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:222,DamageDone,Mother Nature's Protest,963754730,184,0,0,kNormalHit,Demo,Ramux
20260909-22:06:39:255,DamageDone,Basic Shot,947551927,4603,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:323,DamageDone,Mother Nature's Protest,963754730,281,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:323,DamageDone,Mother Nature's Protest,963754730,15,0,0,kNormalHit,Demo,Ramux
20260909-22:06:39:360,DamageDone,Storm Current,952531070,321,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:639,DamageDone,Decisive Sniping,964500434,47204,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:639,DamageDone,Decisive Sniping,964500434,47204,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:639,DamageDone,Decisive Sniping,964500434,47204,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:673,DamageDone,Storm Current,952531070,323,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:673,DamageDone,Storm Current,952531070,323,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:673,DamageDone,Storm Current,952531070,336,0,1,kNormalHit,Demo,Ramux
20260909-22:06:39:707,DamageDone,Mother Nature's Protest,963754730,741,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:707,DamageDone,Mother Nature's Protest,963754730,25,0,0,kNormalHit,Demo,Ramux
20260909-22:06:39:740,DamageDone,Decisive Sniping,964500434,47240,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:740,DamageDone,Decisive Sniping,964500434,123409,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:740,DamageDone,Decisive Sniping,964500434,123409,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:740,DamageDone,Basic Shot,947523317,1569,0,1,kNormalHit,Demo,Ramux
20260909-22:06:39:740,DamageDone,Storm Current,952531070,848,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:740,DamageDone,Storm Current,952531070,323,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:740,DamageDone,Storm Current,952531070,323,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:841,DamageDone,Storm Current,952531070,848,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:878,DamageDone,Decisive Sniping,964500434,138547,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:878,DamageDone,Decisive Sniping,964500434,53024,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:878,DamageDone,Decisive Sniping,964500434,138547,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:878,DamageDone,Storm Current,952531070,951,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:878,DamageDone,Storm Current,952531070,951,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:878,DamageDone,Storm Current,952531070,363,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:978,DamageDone,Decisive Sniping,964500434,53024,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:978,DamageDone,Decisive Sniping,964500434,10347,0,0,kNormalHit,Demo,Ramux
20260909-22:06:39:978,DamageDone,Decisive Sniping,964500434,23926,0,0,kNormalHit,Demo,Ramux
20260909-22:06:39:978,DamageDone,Storm Current,952531070,363,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:978,DamageDone,Storm Current,952531070,363,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:39:978,DamageDone,Storm Current,952531070,951,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:076,DamageDone,Decisive Sniping,964500434,53024,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:076,DamageDone,Decisive Sniping,964500434,138547,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:076,DamageDone,Decisive Sniping,964500434,54939,0,1,kNormalHit,Demo,Ramux
20260909-22:06:40:076,DamageDone,Storm Current,952531070,363,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:076,DamageDone,Storm Current,952531070,878,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:076,DamageDone,Storm Current,952531070,363,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:144,DamageDone,Mother Nature's Protest,963754730,46,0,0,kNormalHit,Demo,Ramux
20260909-22:06:40:145,DamageDone,Roxie's Arrowhead,947532344,7497,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:145,DamageDone,Mother Nature's Protest,963754730,832,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:212,DamageDone,Decisive Sniping,964500434,53024,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:212,DamageDone,Decisive Sniping,964500434,53024,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:212,DamageDone,Decisive Sniping,964500434,138547,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:212,DamageDone,Storm Current,952531070,121,0,0,kNormalHit,Demo,Ramux
20260909-22:06:40:212,DamageDone,Storm Current,952531070,951,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:212,DamageDone,Storm Current,952531070,951,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:213,DamageDone,Detonation Mark,953371309,17564,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:275,DamageDone,Decisive Sniping,964500434,14080,0,0,kNormalHit,Demo,Ramux
20260909-22:06:40:275,DamageDone,Decisive Sniping,964500434,53024,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:275,DamageDone,Decisive Sniping,964500434,138547,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:307,DamageDone,Storm Current,952531070,107,0,0,kNormalHit,Demo,Ramux
20260909-22:06:40:307,DamageDone,Storm Current,952531070,951,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:40:307,DamageDone,Storm Current,952531070,181,0,0,kNormalHit,Demo,Ramux
20260909-22:06:40:339,DamageDone,Storm Current,952531070,192,0,1,kNormalHit,Demo,Ramux
20260909-22:06:40:653,DamageDone,Mother Nature's Protest,963754730,130,0,0,kNormalHit,Demo,Ramux
20260909-22:06:40:653,DamageDone,Mother Nature's Protest,963754730,58,0,0,kNormalHit,Demo,Ramux
20260909-22:06:41:646,DamageDone,Mother Nature's Protest,963754730,65,0,0,kNormalHit,Demo,Ramux
20260909-22:06:41:818,DamageDone,Decisive Sniping,964631505,241129,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:144,DamageDone,Mother Nature's Protest,963754730,757,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:144,DamageDone,Mother Nature's Protest,963754730,29,0,0,kNormalHit,Demo,Ramux
20260909-22:06:42:175,DamageDone,Basic Shot,947551927,585,0,0,kNormalHit,Demo,Ramux
20260909-22:06:42:379,DamageDone,Basic Shot,947523317,4568,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:507,DamageDone,Decisive Sniping,964631505,126185,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:507,DamageDone,Decisive Sniping,964631505,49148,0,1,kNormalHit,Demo,Ramux
20260909-22:06:42:507,DamageDone,Decisive Sniping,964631505,126185,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:538,DamageDone,Mother Nature's Protest,963754730,289,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:538,DamageDone,Mother Nature's Protest,963754730,47,0,0,kNormalHit,Demo,Ramux
20260909-22:06:42:608,DamageDone,Decisive Sniping,964631505,126185,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:608,DamageDone,Decisive Sniping,964631505,126185,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:608,DamageDone,Decisive Sniping,964631505,20379,0,0,kNormalHit,Demo,Ramux
20260909-22:06:42:709,DamageDone,Decisive Sniping,964631505,126185,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:709,DamageDone,Decisive Sniping,964631505,126185,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:709,DamageDone,Decisive Sniping,964631505,126185,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:740,DamageDone,Mother Nature's Protest,963754730,757,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:740,DamageDone,Mother Nature's Protest,963754730,34,0,0,kNormalHit,Demo,Ramux
20260909-22:06:42:842,DamageDone,Basic Shot,947457802,4575,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:935,DamageDone,Decisive Sniping,964631505,27217,0,0,kNormalHit,Demo,Ramux
20260909-22:06:42:935,DamageDone,Decisive Sniping,964631505,126185,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:935,DamageDone,Decisive Sniping,964631505,48300,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:966,DamageDone,Decisive Sniping,964631505,48300,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:966,DamageDone,Decisive Sniping,964631505,48300,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:966,DamageDone,Decisive Sniping,964631505,48300,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:42:966,DamageDone,Ensnaring Arrow,963973967,11092,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:029,DamageDone,Decisive Sniping,964631505,48300,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:029,DamageDone,Decisive Sniping,964631505,124259,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:029,DamageDone,Decisive Sniping,964631505,124259,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:184,DamageDone,Mother Nature's Protest,963754730,757,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:184,DamageDone,Mother Nature's Protest,963754730,121,0,0,kNormalHit,Demo,Ramux
20260909-22:06:43:184,DamageDone,Decisive Sniping,964631505,126185,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:184,DamageDone,Decisive Sniping,964631505,48300,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:184,DamageDone,Decisive Sniping,964631505,126185,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:352,DamageDone,Blade Storm,945408027,8262,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:416,DamageDone,Mother Nature's Protest,963754730,135,0,0,kNormalHit,Demo,Ramux
20260909-22:06:43:416,DamageDone,Mother Nature's Protest,963754730,24,0,0,kNormalHit,Demo,Ramux
20260909-22:06:43:416,DamageDone,Blade Storm,945408027,3240,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:511,DamageDone,Blade Storm,945408027,3802,0,1,kNormalHit,Demo,Ramux
20260909-22:06:43:602,DamageDone,Quick Fire,964762401,30950,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:602,DamageDone,Blade Storm,945408027,8262,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:602,DamageDone,Quick Fire,964762401,26609,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:632,DamageDone,Mother Nature's Protest,963754730,290,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:632,DamageDone,Mother Nature's Protest,963754730,29,0,0,kNormalHit,Demo,Ramux
20260909-22:06:43:666,DamageDone,Quick Fire,964762401,30952,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:666,DamageDone,Storm Current,952531070,866,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:666,DamageDone,Storm Current,952531070,866,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:729,DamageDone,Storm Current,952531070,866,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:761,DamageDone,Blade Storm,945408027,8262,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:761,DamageDone,Mother Nature's Protest,963754730,290,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:761,DamageDone,Mother Nature's Protest,963754730,31,0,0,kNormalHit,Demo,Ramux
20260909-22:06:43:761,DamageDone,Storm Current,952531070,331,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:793,DamageDone,Quick Fire,964762401,30961,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:793,DamageDone,Storm Current,952531070,867,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:860,DamageDone,Mother Nature's Protest,963754730,751,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:860,DamageDone,Storm Current,952531070,328,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:995,DamageDone,Mother Nature's Protest,963754730,285,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:43:995,DamageDone,Mother Nature's Protest,963754730,58,0,0,kNormalHit,Demo,Ramux
20260909-22:06:43:995,DamageDone,Mother Nature's Protest,963754730,4,0,0,kNormalHit,Demo,Ramux
20260909-22:06:43:995,DamageDone,Mother Nature's Protest,963754730,747,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:024,DamageDone,Mother Nature's Protest,963754730,709,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:024,DamageDone,Mother Nature's Protest,963754730,3,0,0,kNormalHit,Demo,Ramux
20260909-22:06:44:055,DamageDone,Basic Shot,947523317,1841,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:055,DamageDone,Mother Nature's Protest,963754730,747,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:056,DamageDone,Mother Nature's Protest,963754730,3,0,0,kNormalHit,Demo,Ramux
20260909-22:06:44:087,DamageDone,Mother Nature's Protest,963754730,285,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:087,DamageDone,Mother Nature's Protest,963754730,6,0,0,kNormalHit,Demo,Ramux
20260909-22:06:44:151,DamageDone,Storm Current,952531070,326,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:181,DamageDone,Mother Nature's Protest,963754730,17,0,0,kNormalHit,Demo,Ramux
20260909-22:06:44:181,DamageDone,Mother Nature's Protest,963754730,747,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:402,DamageDone,Mother Nature's Protest,963754730,747,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:402,DamageDone,Mother Nature's Protest,963754730,75,0,0,kNormalHit,Demo,Ramux
20260909-22:06:44:495,DamageDone,Basic Shot,947457802,1842,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:595,DamageDone,Storm Current,952531070,854,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:630,DamageDone,Detonation Mark,953174691,6159,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:630,DamageDone,Detonation Mark,953174691,5322,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:630,DamageDone,Detonation Mark,953371309,102915,0,0,kNormalHit,Demo,Ramux
20260909-22:06:44:733,DamageDone,Storm Current,952531070,855,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:733,DamageDone,Storm Current,952531070,326,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:733,DamageDone,Storm Current,952531070,161,0,0,kNormalHit,Demo,Ramux
20260909-22:06:44:891,DamageDone,Mother Nature's Protest,963754730,286,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:44:891,DamageDone,Mother Nature's Protest,963754730,128,0,0,kNormalHit,Demo,Ramux
20260909-22:06:45:016,DamageDone,Mother Nature's Protest,963754730,750,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:016,DamageDone,Mother Nature's Protest,963754730,711,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:016,DamageDone,Mother Nature's Protest,963754730,35,0,0,kNormalHit,Demo,Ramux
20260909-22:06:45:048,DamageDone,Mother Nature's Protest,963754730,750,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:048,DamageDone,Mother Nature's Protest,963754730,8,0,0,kNormalHit,Demo,Ramux
20260909-22:06:45:083,DamageDone,Storm Current,952531070,328,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:609,DamageDone,Strafing,945674044,19902,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:609,DamageDone,Strafing,945674044,7656,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:609,DamageDone,Strafing,945674044,7656,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:609,DamageDone,Strafing,945674044,19902,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:693,DamageDone,Storm Current,952531070,854,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:694,DamageDone,Storm Current,952531070,854,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:694,DamageDone,Storm Current,952531070,326,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:694,DamageDone,Storm Current,952531070,326,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:953,DamageDone,Strafing,944953936,19921,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:953,DamageDone,Strafing,944953936,19921,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:953,DamageDone,Strafing,944953936,19921,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:954,DamageDone,Strafing,944953936,19921,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:985,DamageDone,Mother Nature's Protest,963754730,133,0,0,kNormalHit,Demo,Ramux
20260909-22:06:45:985,DamageDone,Mother Nature's Protest,963754730,96,0,0,kNormalHit,Demo,Ramux
20260909-22:06:45:985,DamageDone,Mother Nature's Protest,963754730,285,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:985,DamageDone,Mother Nature's Protest,963754730,747,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:45:985,DamageDone,Mother Nature's Protest,963754730,103,0,0,kNormalHit,Demo,Ramux
20260909-22:06:46:068,DamageDone,Storm Current,952531070,855,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:46:068,DamageDone,Storm Current,952531070,855,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:46:068,DamageDone,Storm Current,952531070,326,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:46:068,DamageDone,Storm Current,952531070,855,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:46:374,DamageDone,Strafing,944299709,19940,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:46:374,DamageDone,Strafing,944299709,1734,0,0,kNormalHit,Demo,Ramux
20260909-22:06:46:374,DamageDone,Strafing,944299709,7671,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:46:374,DamageDone,Strafing,944299709,7671,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:46:374,DamageDone,Mother Nature's Protest,963754730,438,0,1,kNormalHit,Demo,Ramux
20260909-22:06:46:375,DamageDone,Mother Nature's Protest,963754730,748,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:46:375,DamageDone,Mother Nature's Protest,963754730,51,0,0,kNormalHit,Demo,Ramux
20260909-22:06:46:375,DamageDone,Mother Nature's Protest,963754730,285,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:46:375,DamageDone,Mother Nature's Protest,963754730,24,0,0,kNormalHit,Demo,Ramux
20260909-22:06:46:426,DamageDone,Storm Current,952531070,323,0,1,kNormalHit,Demo,Ramux
20260909-22:06:46:426,DamageDone,Storm Current,952531070,66,0,0,kNormalHit,Demo,Ramux
20260909-22:06:46:426,DamageDone,Storm Current,952531070,327,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:46:426,DamageDone,Storm Current,952531070,304,0,1,kNormalHit,Demo,Ramux
20260909-22:06:46:699,DamageDone,Ensnaring Arrow,963973967,9627,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:46:755,DamageDone,Mother Nature's Protest,963754730,264,0,1,kNormalHit,Demo,Ramux
20260909-22:06:46:755,DamageDone,Mother Nature's Protest,963754730,280,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:46:755,DamageDone,Mother Nature's Protest,963754730,344,0,1,kNormalHit,Demo,Ramux
20260909-22:06:46:755,DamageDone,Mother Nature's Protest,963754730,280,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:46:755,DamageDone,Mother Nature's Protest,963754730,42,0,0,kNormalHit,Demo,Ramux
20260909-22:06:46:812,DamageDone,Storm Current,952531070,320,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:47:117,DamageDone,Mother Nature's Protest,963754730,197,0,1,kNormalHit,Demo,Ramux
20260909-22:06:47:117,DamageDone,Mother Nature's Protest,963754730,104,0,0,kNormalHit,Demo,Ramux
20260909-22:06:47:852,DamageDone,Basic Shot,947523317,1613,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:47:968,DamageDone,Storm Current,952531070,329,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:48:112,DamageDone,Mother Nature's Protest,963754730,282,0,0,kNormalHit,Demo,Ramux
20260909-22:06:48:279,DamageDone,Mother Nature's Protest,963754730,285,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:48:546,DamageDone,Detonation Mark,953174691,137814,0,0,kNormalHit,Demo,Ramux
20260909-22:06:48:636,DamageDone,Storm Current,952531070,855,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:48:802,DamageDone,Decisive Sniping,964500434,116181,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:48:802,DamageDone,Storm Current,952531070,326,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:48:961,DamageDone,Mother Nature's Protest,963754730,763,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:48:961,DamageDone,Mother Nature's Protest,963754730,237,0,0,kNormalHit,Demo,Ramux
20260909-22:06:49:104,DamageDone,Mother Nature's Protest,963754730,26,0,0,kNormalHit,Demo,Ramux
20260909-22:06:49:104,DamageDone,Mother Nature's Protest,963754730,796,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:178,DamageDone,Basic Shot,947551927,1689,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:326,DamageDone,Storm Current,952531070,911,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:372,DamageDone,Basic Shot,947523317,4285,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:481,DamageDone,Storm Current,952531070,348,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:557,DamageDone,Blade Storm,945710601,7484,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:557,DamageDone,Blade Storm,945710601,7484,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:613,DamageDone,Storm Current,952531070,348,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:613,DamageDone,Storm Current,952531070,335,0,1,kNormalHit,Demo,Ramux
20260909-22:06:49:635,DamageDone,Mother Nature's Protest,963754730,304,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:665,DamageDone,Blade Storm,945710601,8050,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:665,DamageDone,Blade Storm,945710601,8050,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:743,DamageDone,Storm Current,952531070,986,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:743,DamageDone,Storm Current,952531070,986,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:796,DamageDone,Blade Storm,945710601,3701,0,1,kNormalHit,Demo,Ramux
20260909-22:06:49:797,DamageDone,Blade Storm,945710601,8050,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:797,DamageDone,Mother Nature's Protest,963754730,306,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:797,DamageDone,Mother Nature's Protest,963754730,202,0,0,kNormalHit,Demo,Ramux
20260909-22:06:49:824,DamageDone,Storm Current,952531070,937,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:824,DamageDone,Storm Current,952531070,937,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:875,DamageDone,Blade Storm,945710601,2772,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:875,DamageDone,Blade Storm,945710601,2772,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:905,DamageDone,Storm Current,952531070,333,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:905,DamageDone,Storm Current,952531070,333,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:905,DamageDone,Mother Nature's Protest,963754730,290,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:905,DamageDone,Mother Nature's Protest,963754730,290,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:905,DamageDone,Mother Nature's Protest,963754730,40,0,0,kNormalHit,Demo,Ramux
20260909-22:06:49:958,DamageDone,Blade Storm,945710601,7657,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:49:958,DamageDone,Blade Storm,945710601,7657,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:50:043,DamageDone,Storm Current,952531070,370,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:50:044,DamageDone,Storm Current,952531070,370,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:50:044,DamageDone,Mother Nature's Protest,963754730,360,0,1,kNormalHit,Demo,Ramux
20260909-22:06:50:044,DamageDone,Mother Nature's Protest,963754730,324,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:50:044,DamageDone,Mother Nature's Protest,963754730,13,0,0,kNormalHit,Demo,Ramux
20260909-22:06:50:125,DamageDone,Mother Nature's Protest,963754730,913,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:50:125,DamageDone,Mother Nature's Protest,963754730,913,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:50:125,DamageDone,Mother Nature's Protest,963754730,11,0,0,kNormalHit,Demo,Ramux
20260909-22:06:50:200,DamageDone,Mother Nature's Protest,963754730,288,0,1,kNormalHit,Demo,Ramux
20260909-22:06:50:200,DamageDone,Mother Nature's Protest,963754730,913,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:50:200,DamageDone,Mother Nature's Protest,963754730,13,0,0,kNormalHit,Demo,Ramux
20260909-22:06:50:308,DamageDone,Mother Nature's Protest,963754730,324,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:50:308,DamageDone,Mother Nature's Protest,963754730,324,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:50:308,DamageDone,Roxie's Arrowhead,947532344,11689,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:50:308,DamageDone,Mother Nature's Protest,963754730,18,0,0,kNormalHit,Demo,Ramux
20260909-22:06:51:322,DamageDone,Mother Nature's Protest,963754730,345,0,0,kNormalHit,Demo,Ramux
20260909-22:06:52:008,DamageDone,Decisive Sniping,964631505,592827,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:52:008,DamageDone,Storm Current,952531070,848,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:52:319,DamageDone,Mother Nature's Protest,963754730,741,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:52:319,DamageDone,Mother Nature's Protest,963754730,358,0,0,kNormalHit,Demo,Ramux
20260909-22:06:52:349,DamageDone,Basic Shot,947551927,742,0,0,kNormalHit,Demo,Ramux
20260909-22:06:52:663,DamageDone,Detonation Mark,953174691,5427,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:52:694,DamageDone,Decisive Sniping,964631505,45340,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:52:694,DamageDone,Decisive Sniping,964631505,127486,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:52:694,DamageDone,Decisive Sniping,964631505,45340,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:52:805,DamageDone,Decisive Sniping,964631505,127486,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:52:805,DamageDone,Decisive Sniping,964631505,127486,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:52:805,DamageDone,Decisive Sniping,964631505,68300,0,1,kNormalHit,Demo,Ramux
20260909-22:06:52:886,DamageDone,Mother Nature's Protest,963754730,334,0,1,kNormalHit,Demo,Ramux
20260909-22:06:52:886,DamageDone,Mother Nature's Protest,963754730,162,0,0,kNormalHit,Demo,Ramux
20260909-22:06:52:915,DamageDone,Decisive Sniping,964631505,127486,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:52:915,DamageDone,Decisive Sniping,964631505,127486,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:52:915,DamageDone,Decisive Sniping,964631505,45340,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:53:041,DamageDone,Decisive Sniping,964631505,45340,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:53:041,DamageDone,Decisive Sniping,964631505,45340,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:53:041,DamageDone,Decisive Sniping,964631505,127486,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:53:165,DamageDone,Mother Nature's Protest,963754730,45,0,0,kNormalHit,Demo,Ramux
20260909-22:06:53:165,DamageDone,Mother Nature's Protest,963754730,85,0,0,kNormalHit,Demo,Ramux
20260909-22:06:53:165,DamageDone,Decisive Sniping,964631505,45340,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:53:165,DamageDone,Decisive Sniping,964631505,45340,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:53:165,DamageDone,Decisive Sniping,964631505,45340,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:53:285,DamageDone,Decisive Sniping,964631505,60571,0,1,kNormalHit,Demo,Ramux
20260909-22:06:53:285,DamageDone,Decisive Sniping,964631505,127486,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:53:285,DamageDone,Decisive Sniping,964631505,127486,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:53:378,DamageDone,Decisive Sniping,964631505,16694,0,0,kNormalHit,Demo,Ramux
20260909-22:06:53:378,DamageDone,Decisive Sniping,964631505,46158,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:53:378,DamageDone,Decisive Sniping,964631505,129785,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:54:212,DamageDone,Mother Nature's Protest,963754730,112,0,0,kNormalHit,Demo,Ramux
20260909-22:06:55:169,DamageDone,Mother Nature's Protest,963754730,104,0,0,kNormalHit,Demo,Ramux
20260909-22:06:55:321,DamageDone,Basic Shot,947551927,2498,0,1,kNormalHit,Demo,Ramux
20260909-22:06:55:493,DamageDone,Basic Shot,947523317,4264,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:55:688,DamageDone,Mother Nature's Protest,963754730,56,0,0,kNormalHit,Demo,Ramux
20260909-22:06:55:688,DamageDone,Mother Nature's Protest,963754730,651,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:55:814,DamageDone,Ensnaring Arrow,963973967,3479,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:55:913,DamageDone,Mother Nature's Protest,963754730,263,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:55:913,DamageDone,Mother Nature's Protest,963754730,54,0,0,kNormalHit,Demo,Ramux
20260909-22:06:56:208,DamageDone,Mother Nature's Protest,963754730,263,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:56:208,DamageDone,Mother Nature's Protest,963754730,78,0,0,kNormalHit,Demo,Ramux
20260909-22:06:56:969,DamageDone,Detonation Mark,953174691,99683,0,0,kNormalHit,Demo,Ramux
20260909-22:06:57:197,DamageDone,Mother Nature's Protest,963754730,281,0,0,kNormalHit,Demo,Ramux
20260909-22:06:57:299,DamageDone,Mother Nature's Protest,963754730,262,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:57:299,DamageDone,Mother Nature's Protest,963754730,30,0,0,kNormalHit,Demo,Ramux
20260909-22:06:57:690,DamageDone,Decisive Sniping,964500434,639446,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:001,DamageDone,Mother Nature's Protest,963754730,278,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:002,DamageDone,Mother Nature's Protest,963754730,193,0,0,kNormalHit,Demo,Ramux
20260909-22:06:58:049,DamageDone,Basic Shot,947551927,4864,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:249,DamageDone,Basic Shot,947523317,1812,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:454,DamageDone,Decisive Sniping,964500434,45123,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:454,DamageDone,Decisive Sniping,964500434,45123,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:454,DamageDone,Decisive Sniping,964500434,45123,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:480,DamageDone,Mother Nature's Protest,963754730,276,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:556,DamageDone,Decisive Sniping,964500434,45123,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:556,DamageDone,Decisive Sniping,964500434,126870,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:556,DamageDone,Decisive Sniping,964500434,45123,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:614,DamageDone,Mother Nature's Protest,963754730,276,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:614,DamageDone,Mother Nature's Protest,963754730,185,0,0,kNormalHit,Demo,Ramux
20260909-22:06:58:688,DamageDone,Decisive Sniping,964500434,20788,0,0,kNormalHit,Demo,Ramux
20260909-22:06:58:688,DamageDone,Decisive Sniping,964500434,45123,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:688,DamageDone,Decisive Sniping,964500434,126870,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:810,DamageDone,Decisive Sniping,964500434,45123,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:810,DamageDone,Decisive Sniping,964500434,63585,0,1,kNormalHit,Demo,Ramux
20260909-22:06:58:810,DamageDone,Decisive Sniping,964500434,126870,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:908,DamageDone,Decisive Sniping,964500434,45123,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:908,DamageDone,Decisive Sniping,964500434,45123,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:58:908,DamageDone,Decisive Sniping,964500434,45123,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:59:032,DamageDone,Decisive Sniping,964500434,45123,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:59:032,DamageDone,Decisive Sniping,964500434,126870,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:59:032,DamageDone,Decisive Sniping,964500434,126870,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:59:134,DamageDone,Decisive Sniping,964500434,9396,0,0,kNormalHit,Demo,Ramux
20260909-22:06:59:134,DamageDone,Decisive Sniping,964500434,126870,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:59:134,DamageDone,Decisive Sniping,964500434,126870,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:06:59:608,DamageDone,Mother Nature's Protest,963754730,294,0,0,kNormalHit,Demo,Ramux
20260909-22:07:00:603,DamageDone,Mother Nature's Protest,963754730,273,0,0,kNormalHit,Demo,Ramux
20260909-22:07:00:730,DamageDone,Decisive Sniping,964500434,219383,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:012,DamageDone,Mother Nature's Protest,963754730,276,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:013,DamageDone,Mother Nature's Protest,963754730,103,0,0,kNormalHit,Demo,Ramux
20260909-22:07:01:064,DamageDone,Basic Shot,947551927,0,0,0,kMiss,Demo,Ramux
20260909-22:07:01:482,DamageDone,Decisive Sniping,964500434,128910,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:482,DamageDone,Decisive Sniping,964500434,28514,0,1,kNormalHit,Demo,Ramux
20260909-22:07:01:482,DamageDone,Decisive Sniping,964500434,128910,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:590,DamageDone,Decisive Sniping,964500434,49341,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:590,DamageDone,Decisive Sniping,964500434,49341,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:590,DamageDone,Decisive Sniping,964500434,128910,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:646,DamageDone,Blade Storm,945710601,8427,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:646,DamageDone,Blade Storm,945710601,3301,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:702,DamageDone,Blade Storm,945710601,1250,0,0,kNormalHit,Demo,Ramux
20260909-22:07:01:702,DamageDone,Blade Storm,945710601,8427,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:702,DamageDone,Decisive Sniping,964500434,49335,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:702,DamageDone,Decisive Sniping,964500434,128897,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:702,DamageDone,Decisive Sniping,964500434,128897,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:785,DamageDone,Blade Storm,945710601,786,0,0,kNormalHit,Demo,Ramux
20260909-22:07:01:785,DamageDone,Blade Storm,945710601,3301,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:814,DamageDone,Decisive Sniping,964500434,128877,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:814,DamageDone,Decisive Sniping,964500434,128877,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:814,DamageDone,Decisive Sniping,964500434,128877,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:897,DamageDone,Basic Shot,947523317,620,0,0,kNormalHit,Demo,Ramux
20260909-22:07:01:897,DamageDone,Blade Storm,945710601,3301,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:897,DamageDone,Blade Storm,945710601,8427,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:922,DamageDone,Mother Nature's Protest,963754730,256,0,0,kNormalHit,Demo,Ramux
20260909-22:07:01:923,DamageDone,Mother Nature's Protest,963754730,811,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:923,DamageDone,Mother Nature's Protest,963754730,811,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:923,DamageDone,Decisive Sniping,964500434,128877,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:01:923,DamageDone,Decisive Sniping,964500434,24253,0,0,kNormalHit,Demo,Ramux
20260909-22:07:01:924,DamageDone,Decisive Sniping,964500434,49327,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:004,DamageDone,Blade Storm,945710601,4209,0,1,kNormalHit,Demo,Ramux
20260909-22:07:02:004,DamageDone,Blade Storm,945710601,3301,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:031,DamageDone,Ensnaring Arrow,963973967,11868,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:031,DamageDone,Mother Nature's Protest,963754730,88,0,0,kNormalHit,Demo,Ramux
20260909-22:07:02:031,DamageDone,Mother Nature's Protest,963754730,811,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:031,DamageDone,Mother Nature's Protest,963754730,15,0,0,kNormalHit,Demo,Ramux
20260909-22:07:02:060,DamageDone,Decisive Sniping,964500434,128877,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:060,DamageDone,Decisive Sniping,964500434,49327,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:060,DamageDone,Decisive Sniping,964500434,128877,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:116,DamageDone,Mother Nature's Protest,963754730,17,0,0,kNormalHit,Demo,Ramux
20260909-22:07:02:116,DamageDone,Mother Nature's Protest,963754730,96,0,0,kNormalHit,Demo,Ramux
20260909-22:07:02:116,DamageDone,Mother Nature's Protest,963754730,811,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:145,DamageDone,Decisive Sniping,964500434,31194,0,1,kNormalHit,Demo,Ramux
20260909-22:07:02:145,DamageDone,Decisive Sniping,964500434,49327,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:145,DamageDone,Decisive Sniping,964500434,128877,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:232,DamageDone,Mother Nature's Protest,963754730,310,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:232,DamageDone,Mother Nature's Protest,963754730,153,0,0,kNormalHit,Demo,Ramux
20260909-22:07:02:233,DamageDone,Mother Nature's Protest,963754730,5,0,0,kNormalHit,Demo,Ramux
20260909-22:07:02:262,DamageDone,Mother Nature's Protest,963754730,7,0,0,kNormalHit,Demo,Ramux
20260909-22:07:02:262,DamageDone,Mother Nature's Protest,963754730,310,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:321,DamageDone,Mother Nature's Protest,963754730,276,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:321,DamageDone,Mother Nature's Protest,963754730,315,0,1,kNormalHit,Demo,Ramux
20260909-22:07:02:321,DamageDone,Mother Nature's Protest,963754730,19,0,0,kNormalHit,Demo,Ramux
20260909-22:07:02:406,DamageDone,Mother Nature's Protest,963754730,723,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:02:407,DamageDone,Mother Nature's Protest,963754730,16,0,0,kNormalHit,Demo,Ramux
20260909-22:07:03:412,DamageDone,Mother Nature's Protest,963754730,106,0,0,kNormalHit,Demo,Ramux
20260909-22:07:03:949,DamageDone,Basic Shot,947551927,693,0,0,kNormalHit,Demo,Ramux
20260909-22:07:04:326,DamageDone,Mother Nature's Protest,963754730,238,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:04:327,DamageDone,Mother Nature's Protest,963754730,95,0,0,kNormalHit,Demo,Ramux
20260909-22:07:04:565,DamageDone,Basic Shot,947523317,3692,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:04:637,DamageDone,Detonation Mark,953174691,12373,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:04:666,DamageDone,Detonation Mark,953174691,10694,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:04:732,DamageDone,Detonation Mark,953174691,3605,0,0,kNormalHit,Demo,Ramux
20260909-22:07:04:936,DamageDone,Mother Nature's Protest,963754730,623,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:04:936,DamageDone,Mother Nature's Protest,963754730,147,0,0,kNormalHit,Demo,Ramux
20260909-22:07:05:010,DamageDone,Mother Nature's Protest,963754730,238,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:010,DamageDone,Mother Nature's Protest,963754730,7,0,0,kNormalHit,Demo,Ramux
20260909-22:07:05:082,DamageDone,Mother Nature's Protest,963754730,102,0,1,kNormalHit,Demo,Ramux
20260909-22:07:05:082,DamageDone,Mother Nature's Protest,963754730,238,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:082,DamageDone,Mother Nature's Protest,963754730,4,0,0,kNormalHit,Demo,Ramux
20260909-22:07:05:103,DamageDone,Strafing,945674044,6935,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:103,DamageDone,Strafing,945674044,3216,0,0,kNormalHit,Demo,Ramux
20260909-22:07:05:103,DamageDone,Strafing,945674044,4556,0,1,kNormalHit,Demo,Ramux
20260909-22:07:05:103,DamageDone,Strafing,945674044,6935,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:245,DamageDone,Storm Current,952531070,713,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:245,DamageDone,Storm Current,952531070,273,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:245,DamageDone,Storm Current,952531070,273,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:245,DamageDone,Storm Current,952531070,273,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:477,DamageDone,Mother Nature's Protest,963754730,629,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:477,DamageDone,Mother Nature's Protest,963754730,629,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:477,DamageDone,Mother Nature's Protest,963754730,240,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:477,DamageDone,Mother Nature's Protest,963754730,367,0,1,kNormalHit,Demo,Ramux
20260909-22:07:05:477,DamageDone,Mother Nature's Protest,963754730,36,0,0,kNormalHit,Demo,Ramux
20260909-22:07:05:522,DamageDone,Strafing,944953936,6510,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:522,DamageDone,Strafing,944953936,16823,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:522,DamageDone,Strafing,944953936,6510,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:522,DamageDone,Strafing,944953936,2635,0,0,kNormalHit,Demo,Ramux
20260909-22:07:05:642,DamageDone,Storm Current,952531070,720,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:642,DamageDone,Storm Current,952531070,392,0,1,kNormalHit,Demo,Ramux
20260909-22:07:05:642,DamageDone,Storm Current,952531070,720,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:642,DamageDone,Storm Current,952531070,720,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:903,DamageDone,Roxie's Arrowhead,947532344,3084,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:903,DamageDone,Mother Nature's Protest,963754730,631,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:903,DamageDone,Mother Nature's Protest,963754730,631,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:903,DamageDone,Mother Nature's Protest,963754730,240,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:903,DamageDone,Mother Nature's Protest,963754730,323,0,1,kNormalHit,Demo,Ramux
20260909-22:07:05:903,DamageDone,Mother Nature's Protest,963754730,97,0,0,kNormalHit,Demo,Ramux
20260909-22:07:05:924,DamageDone,Strafing,944299709,16866,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:924,DamageDone,Strafing,944299709,16866,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:924,DamageDone,Strafing,944299709,6527,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:05:924,DamageDone,Strafing,944299709,16866,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:06:048,DamageDone,Storm Current,952531070,275,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:06:048,DamageDone,Storm Current,952531070,275,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:06:048,DamageDone,Storm Current,952531070,275,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:06:049,DamageDone,Storm Current,952531070,373,0,1,kNormalHit,Demo,Ramux
20260909-22:07:06:322,DamageDone,Mother Nature's Protest,963754730,146,0,1,kNormalHit,Demo,Ramux
20260909-22:07:06:323,DamageDone,Mother Nature's Protest,963754730,347,0,1,kNormalHit,Demo,Ramux
20260909-22:07:06:323,DamageDone,Mother Nature's Protest,963754730,632,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:06:323,DamageDone,Mother Nature's Protest,963754730,632,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:06:323,DamageDone,Mother Nature's Protest,963754730,62,0,0,kNormalHit,Demo,Ramux
20260909-22:07:07:322,DamageDone,Mother Nature's Protest,963754730,91,0,0,kNormalHit,Demo,Ramux
20260909-22:07:08:233,DamageDone,Decisive Sniping,964500434,301316,0,1,kNormalHit,Demo,Ramux
20260909-22:07:08:233,DamageDone,Storm Current,952531070,327,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:08:327,DamageDone,Mother Nature's Protest,963754730,106,0,0,kNormalHit,Demo,Ramux
20260909-22:07:08:512,DamageDone,Detonation Mark,953174691,194669,0,0,kNormalHit,Demo,Ramux
20260909-22:07:08:512,DamageDone,Mother Nature's Protest,963754730,136,0,1,kNormalHit,Demo,Ramux
20260909-22:07:08:512,DamageDone,Mother Nature's Protest,963754730,22,0,0,kNormalHit,Demo,Ramux
20260909-22:07:08:584,DamageDone,Basic Shot,947551927,603,0,0,kNormalHit,Demo,Ramux
20260909-22:07:08:638,DamageDone,Storm Current,952531070,327,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:08:690,DamageDone,Storm Current,952531070,858,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:08:816,DamageDone,Ensnaring Arrow,963973967,9391,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:08:912,DamageDone,Storm Current,952531070,324,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:08:938,DamageDone,Mother Nature's Protest,963754730,705,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:08:938,DamageDone,Mother Nature's Protest,963754730,26,0,0,kNormalHit,Demo,Ramux
20260909-22:07:08:964,DamageDone,Mother Nature's Protest,963754730,743,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:08:964,DamageDone,Mother Nature's Protest,963754730,12,0,0,kNormalHit,Demo,Ramux
20260909-22:07:08:964,DamageDone,Decisive Sniping,964500434,40068,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:08:964,DamageDone,Decisive Sniping,964500434,40068,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:08:964,DamageDone,Decisive Sniping,964500434,112720,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:08:988,DamageDone,Storm Current,952531070,324,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:08:988,DamageDone,Storm Current,952531070,324,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:08:989,DamageDone,Storm Current,952531070,324,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:088,DamageDone,Decisive Sniping,964500434,112720,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:088,DamageDone,Decisive Sniping,964500434,112720,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:088,DamageDone,Decisive Sniping,964500434,40068,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:112,DamageDone,Storm Current,952531070,324,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:112,DamageDone,Storm Current,952531070,324,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:112,DamageDone,Storm Current,952531070,498,0,1,kNormalHit,Demo,Ramux
20260909-22:07:09:166,DamageDone,Blade Storm,945408027,7537,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:189,DamageDone,Storm Current,952531070,324,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:189,DamageDone,Blade Storm,945408027,2729,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:189,DamageDone,Mother Nature's Protest,963754730,177,0,1,kNormalHit,Demo,Ramux
20260909-22:07:09:190,DamageDone,Mother Nature's Protest,963754730,23,0,0,kNormalHit,Demo,Ramux
20260909-22:07:09:190,DamageDone,Decisive Sniping,964500434,112720,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:190,DamageDone,Decisive Sniping,964500434,112720,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:190,DamageDone,Decisive Sniping,964500434,112720,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:216,DamageDone,Storm Current,952531070,850,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:216,DamageDone,Storm Current,952531070,324,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:217,DamageDone,Storm Current,952531070,324,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:294,DamageDone,Storm Current,952531070,929,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:294,DamageDone,Decisive Sniping,964500434,115017,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:294,DamageDone,Decisive Sniping,964500434,13725,0,0,kNormalHit,Demo,Ramux
20260909-22:07:09:294,DamageDone,Decisive Sniping,964500434,46333,0,1,kNormalHit,Demo,Ramux
20260909-22:07:09:319,DamageDone,Storm Current,952531070,867,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:319,DamageDone,Storm Current,952531070,331,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:319,DamageDone,Storm Current,952531070,330,0,1,kNormalHit,Demo,Ramux
20260909-22:07:09:319,DamageDone,Blade Storm,945408027,2771,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:437,DamageDone,Storm Current,952531070,933,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:437,DamageDone,Blade Storm,945408027,3452,0,1,kNormalHit,Demo,Ramux
20260909-22:07:09:437,DamageDone,Decisive Sniping,964500434,115003,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:437,DamageDone,Decisive Sniping,964500434,115003,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:437,DamageDone,Decisive Sniping,964500434,115003,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:437,DamageDone,Storm Current,952531070,933,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:437,DamageDone,Storm Current,952531070,331,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:437,DamageDone,Storm Current,952531070,331,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:437,DamageDone,Basic Shot,947523317,1585,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:463,DamageDone,Mother Nature's Protest,963754730,290,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:464,DamageDone,Mother Nature's Protest,963754730,80,0,0,kNormalHit,Demo,Ramux
20260909-22:07:09:491,DamageDone,Storm Current,952531070,331,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:516,DamageDone,Blade Storm,945408027,2771,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:516,DamageDone,Decisive Sniping,964500434,37951,0,1,kNormalHit,Demo,Ramux
20260909-22:07:09:516,DamageDone,Decisive Sniping,964500434,15315,0,0,kNormalHit,Demo,Ramux
20260909-22:07:09:516,DamageDone,Decisive Sniping,964500434,115044,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:542,DamageDone,Storm Current,952531070,933,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:543,DamageDone,Storm Current,952531070,331,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:543,DamageDone,Storm Current,952531070,531,0,1,kNormalHit,Demo,Ramux
20260909-22:07:09:543,DamageDone,Storm Current,952531070,136,0,0,kNormalHit,Demo,Ramux
20260909-22:07:09:569,DamageDone,Mother Nature's Protest,963754730,325,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:569,DamageDone,Mother Nature's Protest,963754730,33,0,0,kNormalHit,Demo,Ramux
20260909-22:07:09:621,DamageDone,Storm Current,952531070,933,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:621,DamageDone,Decisive Sniping,964500434,129080,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:621,DamageDone,Decisive Sniping,964500434,129080,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:621,DamageDone,Decisive Sniping,964500434,10065,0,0,kNormalHit,Demo,Ramux
20260909-22:07:09:646,DamageDone,Storm Current,952531070,371,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:646,DamageDone,Storm Current,952531070,1048,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:646,DamageDone,Storm Current,952531070,1048,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:701,DamageDone,Mother Nature's Protest,963754730,916,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:701,DamageDone,Mother Nature's Protest,963754730,7,0,0,kNormalHit,Demo,Ramux
20260909-22:07:09:781,DamageDone,Mother Nature's Protest,963754730,916,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:839,DamageDone,Weak Point Shot,968554562,10426,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:839,DamageDone,Mother Nature's Protest,963754730,325,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:839,DamageDone,Mother Nature's Protest,963754730,54,0,0,kNormalHit,Demo,Ramux
20260909-22:07:09:864,DamageDone,Mother Nature's Protest,963754730,916,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:09:864,DamageDone,Mother Nature's Protest,963754730,3,0,0,kNormalHit,Demo,Ramux
20260909-22:07:09:972,DamageDone,Storm Current,952531070,89,0,0,kNormalHit,Demo,Ramux
20260909-22:07:10:236,DamageDone,Mother Nature's Protest,963754730,926,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:10:236,DamageDone,Mother Nature's Protest,963754730,46,0,0,kNormalHit,Demo,Ramux
20260909-22:07:10:397,DamageDone,Basic Shot,947551927,5271,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:10:533,DamageDone,Storm Current,952531070,372,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:10:845,DamageDone,Mother Nature's Protest,963754730,819,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:10:845,DamageDone,Mother Nature's Protest,963754730,208,0,0,kNormalHit,Demo,Ramux
20260909-22:07:11:051,DamageDone,Basic Shot,947523317,1749,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:11:156,DamageDone,Storm Current,952531070,332,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:11:468,DamageDone,Mother Nature's Protest,963754730,818,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:11:468,DamageDone,Mother Nature's Protest,963754730,68,0,0,kNormalHit,Demo,Ramux
20260909-22:07:12:462,DamageDone,Mother Nature's Protest,963754730,309,0,0,kNormalHit,Demo,Ramux
20260909-22:07:12:627,DamageDone,Decisive Sniping,964631505,224903,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:12:916,DamageDone,Mother Nature's Protest,963754730,817,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:12:916,DamageDone,Mother Nature's Protest,963754730,141,0,0,kNormalHit,Demo,Ramux
20260909-22:07:13:010,DamageDone,Basic Shot,947551927,4535,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:250,DamageDone,Ensnaring Arrow,963973967,3999,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:370,DamageDone,Decisive Sniping,964631505,44059,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:370,DamageDone,Decisive Sniping,964631505,123871,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:370,DamageDone,Decisive Sniping,964631505,44059,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:416,DamageDone,Mother Nature's Protest,963754730,136,0,0,kNormalHit,Demo,Ramux
20260909-22:07:13:416,DamageDone,Mother Nature's Protest,963754730,53,0,0,kNormalHit,Demo,Ramux
20260909-22:07:13:464,DamageDone,Decisive Sniping,964631505,123871,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:464,DamageDone,Decisive Sniping,964631505,123871,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:464,DamageDone,Decisive Sniping,964631505,123871,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:563,DamageDone,Blade Storm,945710601,2818,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:563,DamageDone,Blade Storm,945710601,7694,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:586,DamageDone,Decisive Sniping,964631505,123871,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:586,DamageDone,Decisive Sniping,964631505,123871,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:586,DamageDone,Decisive Sniping,964631505,123871,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:639,DamageDone,Blade Storm,945710601,7694,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:639,DamageDone,Blade Storm,945710601,2770,0,1,kNormalHit,Demo,Ramux
20260909-22:07:13:663,DamageDone,Mother Nature's Protest,963754730,799,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:663,DamageDone,Mother Nature's Protest,963754730,28,0,0,kNormalHit,Demo,Ramux
20260909-22:07:13:694,DamageDone,Decisive Sniping,964631505,44059,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:695,DamageDone,Decisive Sniping,964631505,44059,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:695,DamageDone,Decisive Sniping,964631505,123871,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:756,DamageDone,Blade Storm,945710601,2818,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:756,DamageDone,Blade Storm,945710601,2818,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:822,DamageDone,Decisive Sniping,964631505,24585,0,0,kNormalHit,Demo,Ramux
20260909-22:07:13:822,DamageDone,Decisive Sniping,964631505,12045,0,0,kNormalHit,Demo,Ramux
20260909-22:07:13:822,DamageDone,Decisive Sniping,964631505,123871,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:822,DamageDone,Basic Shot,947523317,4564,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:857,DamageDone,Blade Storm,945710601,2818,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:857,DamageDone,Blade Storm,945710601,2495,0,1,kNormalHit,Demo,Ramux
20260909-22:07:13:916,DamageDone,Decisive Sniping,964631505,123871,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:916,DamageDone,Decisive Sniping,964631505,123871,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:916,DamageDone,Decisive Sniping,964631505,123871,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:916,DamageDone,Mother Nature's Protest,963754730,80,0,0,kNormalHit,Demo,Ramux
20260909-22:07:13:916,DamageDone,Mother Nature's Protest,963754730,799,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:916,DamageDone,Roxie's Arrowhead,947532344,10794,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:13:917,DamageDone,Mother Nature's Protest,963754730,284,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:000,DamageDone,Detonation Mark,953174691,15450,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:000,DamageDone,Blade Storm,945710601,2818,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:000,DamageDone,Blade Storm,945710601,2667,0,1,kNormalHit,Demo,Ramux
20260909-22:07:14:000,DamageDone,Detonation Mark,953174691,13320,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:001,DamageDone,Mother Nature's Protest,963754730,325,0,1,kNormalHit,Demo,Ramux
20260909-22:07:14:001,DamageDone,Mother Nature's Protest,963754730,799,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:001,DamageDone,Detonation Mark,953174691,4572,0,0,kNormalHit,Demo,Ramux
20260909-22:07:14:001,DamageDone,Mother Nature's Protest,963754730,23,0,0,kNormalHit,Demo,Ramux
20260909-22:07:14:026,DamageDone,Decisive Sniping,964631505,44059,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:026,DamageDone,Decisive Sniping,964631505,44059,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:026,DamageDone,Decisive Sniping,964631505,123871,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:110,DamageDone,Mother Nature's Protest,963754730,799,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:110,DamageDone,Mother Nature's Protest,963754730,284,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:110,DamageDone,Mother Nature's Protest,963754730,9,0,0,kNormalHit,Demo,Ramux
20260909-22:07:14:214,DamageDone,Mother Nature's Protest,963754730,799,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:214,DamageDone,Mother Nature's Protest,963754730,799,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:214,DamageDone,Mother Nature's Protest,963754730,799,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:214,DamageDone,Mother Nature's Protest,963754730,33,0,0,kNormalHit,Demo,Ramux
20260909-22:07:14:319,DamageDone,Mother Nature's Protest,963754730,281,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:319,DamageDone,Mother Nature's Protest,963754730,281,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:320,DamageDone,Mother Nature's Protest,963754730,13,0,0,kNormalHit,Demo,Ramux
20260909-22:07:14:345,DamageDone,Mother Nature's Protest,963754730,792,1,1,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:345,DamageDone,Mother Nature's Protest,963754730,4,0,0,kNormalHit,Demo,Ramux
20260909-22:07:14:396,DamageDone,Mother Nature's Protest,963754730,3,0,0,kNormalHit,Demo,Ramux
20260909-22:07:14:396,DamageDone,Mother Nature's Protest,963754730,267,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:396,DamageDone,Mother Nature's Protest,963754730,281,1,0,kMaxDamageByCriticalDecision,Demo,Ramux
20260909-22:07:14:396,DamageDone,Mother Nature's Protest,963754730,4,0,0,kNormalHit,Demo,Ramux
20260909-22:07:15:392,DamageDone,Mother Nature's Protest,963754730,106,0,0,kNormalHit,Demo,Ramux
20260909-22:07:16:387,DamageDone,Mother Nature's Protest,963754730,92,0,0,kNormalHit,Demo,Ramux
20260909-22:07:17:398,DamageDone,Mother Nature's Protest,963754730,91,0,0,kNormalHit,Demo,Ramux
20260909-22:07:17:398,DamageDone,Detonation Mark,953174691,146777,0,0,kNormalHit,Demo,Ramux
20260909-22:07:17:998,DamageDone,Mother Nature's Protest,963754730,52,0,0,kNormalHit,Demo,Ramux`;
export function sample(){
  state.delim = "auto"; state.headerMode = "auto";
  // a cutoff left over from Clear would hide the sample entirely: its
  // timestamps are older than anything you have been reading today
  state.clearBefore = 0;
  // und aus demselben Grund die entfernten: das Beispiel bringt seine
  // eigenen zwei Kaempfe mit und niemand hat sie je herausgenommen
  state.entfernt.clear();
  setLoadingSample(true);
  setLoadOrigin("sample");
  /* Der Name geht in die Meldung "N Kaempfe aus X gelesen". Mit einem
     englischen Festtext stand dort auf deutsch "2 Kaempfe aus sample
     fight gelesen" - ein halb uebersetzter Satz. */
  try { loadText(SAMPLE_LOG, [t("land.sample")]); }
  finally { setLoadingSample(false); }
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  $("#btnSample").onclick = $("#btnSample2").onclick = $("#landBspZeile").onclick = sample;
}
