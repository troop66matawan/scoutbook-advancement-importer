const csvToJson = require('csvtojson');
const Scout = require('scoutbook-scout');
const ScoutbookAdvancement = require('scoutbook-advancement/advancement');
const ScoutbookRankAdvancement = require('scoutbook-advancement/rankAdvancement');
const ScoutbookAuditMark = require('scoutbook-advancement/auditMark');
const ScoutbookMeritBadgeAdvancement = require('scoutbook-advancement/meritBadgeAdvancement');

exports.scoutbook_advancement_importer = function (scouts, importPath) {
    const supportedTypes = [
        'Rank',
        'Merit Badge',
//        'Merit Badge Requirement',
//        'Award',
//        'Award Requirement',
    ];

    const scoutsBSARankRequirementAdvancementTypes = {
        'Scout Rank Requirement' : 'Scout',
        'Tenderfoot Rank Requirement': 'Tenderfoot',
        'Second Class Rank Requirement': 'Second Class',
        'First Class Rank Requirement': 'First Class',
        'Star Scout Rank Requirement': 'Star Scout',
        'Life Scout Rank Requirement': 'Life Scout',
        'Eagle Scout Rank Requirement': 'Eagle Scout',
    };

    function stringToDate(stringDate) {
        let date;
        if (stringDate !== '') {
            const dateSegments = stringDate.split('/');
            if (dateSegments.length === 3) {
                date = new Date(dateSegments[2], dateSegments[0]-1, dateSegments[1])
            }
        }
        return date;
    }

    return csvToJson()
        .on('header', function (header) {
            console.log(header);
        })
        .fromFile(importPath)
        .then(function (importedData) {
            importedData.forEach(advancementRecord => {
                const bsaId = advancementRecord['BSA Member ID'];
                const firstName = advancementRecord['First Name'].trim();
                const middleName = advancementRecord['Middle Name'].trim();
                const lastName = advancementRecord['Last Name'].trim();
                let advancementType = advancementRecord['Advancement Type'];
                let advancement = advancementRecord['Advancement'];
                const advancementVersion = advancementRecord['Version'];
                const dateCompleted = advancementRecord['Date Completed'];
                const approved = advancementRecord['Approved'] === '1' || advancementRecord['Approved'] === "True";
                const awarded = advancementRecord['Awarded'] === '1' || advancementRecord['Awarded'] === 'True';
                const completedBy = Object.hasOwn(advancementRecord, 'MarkedCompletedBy') ?
                    advancementRecord['MarkedCompletedBy'] :
                Object.hasOwn(advancementRecord, 'Marked Completed By') ?
                    advancementRecord['Marked Completed By'] : undefined  ;
                const completedOn = Object.hasOwn(advancementRecord, 'MarkedCompletedDate') ?
                    advancementRecord['MarkedCompletedDate'] :
                    Object.hasOwn(advancementRecord, 'Marked Completed Date') ?
                        advancementRecord['Marked Completed Date'] : undefined;
                const approvedBy = Object.hasOwn(advancementRecord, 'LeaderApprovedBy') ?
                    advancementRecord['LeaderApprovedBy'] :
                    Object.hasOwn(advancementRecord, 'Leader Approved By') ?
                        advancementRecord['Leader Approved By'] : undefined;
                const approvedOn = Object.hasOwn(advancementRecord, 'LeaderApprovedDate') ?
                    advancementRecord['LeaderApprovedDate'] :
                    Object.hasOwn(advancementRecord, 'Leader Approved Date') ?
                        advancementRecord['Leader Approved Date'] : undefined;
                const awardedBy = Object.hasOwn(advancementRecord, 'AwardedBy') ?
                    advancementRecord['AwardedBy'] :
                    Object.hasOwn(advancementRecord, 'Awarded By') ?
                        advancementRecord['Awarded By'] : undefined;
                const awardedOn = Object.hasOwn(advancementRecord, 'AwardedDate') ?
                    advancementRecord['AwardedDate'] :
                    Object.hasOwn(advancementRecord, 'Awarded Date') ?
                        advancementRecord['Awarded Date'] : undefined;

                const scoutKey = bsaId + '_' + firstName  + '_' + lastName;
                let scout;
                if (scouts[scoutKey]) {
                    scout = scouts[scoutKey];
                } else {
                    scout = new Scout(bsaId,firstName,middleName,lastName,'');
                    scouts[scoutKey] = scout;
                }

                if(advancementType === 'Merit Badges') {
                    advancementType = 'Merit Badge'
                }
                if (supportedTypes.includes(advancementType) || scoutsBSARankRequirementAdvancementTypes.hasOwnProperty(advancementType)) {
                    let rankAdvancement;
                    if (advancementType === 'Rank') {
                        const rankSuffix = ' Rank'
                        if (advancement.endsWith(rankSuffix)) {
                            const splits =  advancement.split(rankSuffix);
                            advancement = splits[0];
                        }
                       if (ScoutbookAdvancement.supportedRanks.includes(advancement)) {
                           const scoutAdvancement = scout.advancement;
                           if (scoutAdvancement[advancement] === undefined) {
                               scoutAdvancement[advancement] = new ScoutbookRankAdvancement(advancement, advancementVersion);
                           }
                           rankAdvancement = scoutAdvancement[advancement];
                       }
                    } else if (advancementType === 'Merit Badge') {
                        const scoutAdvancement = scout.advancement;
                        const discontinueIndex = advancement.indexOf('  Discontinued');
                        let mbName = advancement;
                        if (discontinueIndex !== -1) {
                            mbName = advancement.substr(0, discontinueIndex-1);
                        }
                        rankAdvancement = new ScoutbookMeritBadgeAdvancement(mbName, advancementVersion);
                        scoutAdvancement.addMeritBadge(rankAdvancement);
                    }
                    else if (scoutsBSARankRequirementAdvancementTypes[advancementType] !== undefined) {
                        let rank = scoutsBSARankRequirementAdvancementTypes[advancementType];
                        if (ScoutbookAdvancement.supportedRanks.includes(rank)) {
                            let scoutAdvancement = scout.advancement;
                            if (scoutAdvancement[rank] === undefined) {
                                scoutAdvancement[rank] = new ScoutbookRankAdvancement(rank, advancementVersion);
                            }
                            const requirements = scoutAdvancement[rank].requirements;
                            rankAdvancement = requirements.requirement[advancement];
                        }
                    }
                    if (rankAdvancement) {
                        if (dateCompleted !== '') {
                            rankAdvancement.completionDate = stringToDate(dateCompleted);
                            if (completedOn !== undefined && (completedBy !== '' || completedOn !== '')) {
                                rankAdvancement.markedCompleted = new ScoutbookAuditMark(completedBy, stringToDate(completedOn));
                            }
                        }
                        if (approved) {
                            rankAdvancement.isApproved = true;
                            if (approvedOn !== undefined && (approvedBy !== '' || approvedOn !== '')) {
                                rankAdvancement.markedApproved = new ScoutbookAuditMark(approvedBy, stringToDate(approvedOn));
                            }
                        }
                        if (awarded) {
                            rankAdvancement.isAwarded = true;
                            if ( awardedOn !== undefined && (awardedBy !== '' || awardedOn !== '')) {
                                rankAdvancement.markedAwarded = new ScoutbookAuditMark(awardedBy, stringToDate(awardedOn));
                            }
                        }
                    }
                }
            });
            return scouts;
        });
};

if (process.argv.length !== 3) {
    console.log('Usage: ' + process.argv[1] + ' <scoutbook_advancement.csv file to import>');
} else {
    exports.scoutbook_advancement_importer({},process.argv[2])
        .then(function (scouts) {
            console.log(JSON.stringify(scouts));
        })
        .catch(function (err) {
            console.error(err.message);
        });
}

