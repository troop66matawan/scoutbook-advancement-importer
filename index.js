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
                const firstName = advancementRecord['First Name'];
                const middleName = advancementRecord['Middle Name'];
                const lastName = advancementRecord['Last Name'];
                const type = advancementRecord['Advancement Type'];
                const advancement = advancementRecord['Advancement'];
                const advancementVersion = advancementRecord['Version'];
                const dateCompleted = advancementRecord['Date Completed'];
                const approved = advancementRecord['Approved'] === '1';
                const awarded = advancementRecord['Awarded'] === '1';
                const completedBy = advancementRecord['MarkedCompletedBy'];
                const completedOn = advancementRecord['MarkedCompletedDate'];
                const approvedBy = advancementRecord['LeaderApprovedBy'];
                const approvedOn = advancementRecord['LeaderApprovedDate'];
                const awardedBy = advancementRecord['AwardedBy'];
                const awardedOn = advancementRecord['AwardedDate'];

                const scoutKey = bsaId + '_' + firstName + '_' + middleName + '_' + lastName;
                let scout;
                if (scouts[scoutKey]) {
                    scout = scouts[scoutKey];
                } else {
                    scout = new Scout(bsaId,firstName,middleName,lastName,'');
                    scouts[scoutKey] = scout;
                }

                if (supportedTypes.includes(type) || scoutsBSARankRequirementAdvancementTypes.hasOwnProperty(type)) {
                    let rankAdvancement;
                    if (type === 'Rank') {
                       if (ScoutbookAdvancement.supportedRanks.includes(advancement)) {
                           const scoutAdvancement = scout.advancement;
                           if (scoutAdvancement[advancement] === undefined) {
                               scoutAdvancement[advancement] = new ScoutbookRankAdvancement(advancement, advancementVersion);
                           }
                           rankAdvancement = scoutAdvancement[advancement];
                       }
                    } else if (type === 'Merit Badge') {
                        const scoutAdvancement = scout.advancement;
                        rankAdvancement = new ScoutbookMeritBadgeAdvancement(advancement, advancementVersion);
                        scoutAdvancement.addMeritBadge(rankAdvancement);
                    }
                    else if (scoutsBSARankRequirementAdvancementTypes[type] !== undefined) {
                        let rank = scoutsBSARankRequirementAdvancementTypes[type];
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
                            if (completedBy !== '' || completedOn !== '') {
                                rankAdvancement.markedCompleted = new ScoutbookAuditMark(completedBy, stringToDate(completedOn));
                            }
                        }
                        if (approved) {
                            rankAdvancement.isApproved = true;
                            if (approvedBy !== '' || approvedOn !== '') {
                                rankAdvancement.markedApproved = new ScoutbookAuditMark(approvedBy, stringToDate(approvedOn));
                            }
                        }
                        if (awarded) {
                            rankAdvancement.isAwarded = true;
                            if (awardedBy !== '' || awardedOn !== '') {
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

