var _ = require('lodash');
var keystone = require('../../');
var Types = require('../fieldTypes');

/**
 * Publishing Workflow Plugin V0.1
 *
 * When this option is enabled for a list publishing options are enabled allowing for:
 * Request state change
 * Approve requests
 * Schedule Publishing & Unpublishing
 *
 * List.options:
 * If only publishing:true is set these defaults will be used.
 * publishing: {
 *      enabled: false // can be disabled
 *      stateField: 'publishing.state', // field to publishing content state
 *      selfApproval: true, // Allows users to self approval to change state
 *      approvalStates: ['draft', 'published', 'archived', 'deleted'],
 * 		previewStates: ['draft', 'published', 'archived', 'deleted'], // States that can be viewed in preview mode
 *      unpublishStates: ['archived','draft'] // default state for unpublished content
 * 		publishStates: ['published'],
 * }
 *
 * User.permissins: (Using WP Roles as our reference https://codex.wordpress.org/Roles_and_Capabilities)
 * With publishing enabled these User.permissions fields need to be added to enable publishing roles:
 * isContributor - Can create & edit own content
 * isAuthor - Can create, edit & publish own content
 * isEditor - Can crete, edit & publish any content
 *
 * Note:
 * Rollback features are handled by Revisions by enabling with the 'history' option
 * This is an early version of this feature and may be refactored in future KeystoneJS versions.
 */

module.exports = function publishing () {

	var list = this;
	var options = list.get('publishing');

    // Enabled only if 'publishing' option is enabled
	if (!options || !options.enabled) {
		return;
	}

    // Default options if only publishing: true is defined or any of these are omitted
	var defaultOptions = {
		enabled: true,
		stateField: 'publishing.state',
		selfApproval: true,
		approvalStates: ['draft', 'published', 'archived', 'deleted'],
		previewStates: ['draft', 'published', 'archived', 'deleted'],
		unpublishStates: ['draft', 'archived'],
		publishStates: ['published'],
	};

	// ensure publishing option is a boolean or an object
	if (!_.isBoolean(options) && !_.isObject(options)) {
		throw new Error('Invalid List "publishing" option for ' + list.key + '\n'
			+ '"publishing" must be a boolean or an object.\n\n'
			+ 'See http://keystonejs.com/docs/database/#lists-options for more information.');
	}

	// merge user options with default options
	options = _.extend({}, defaultOptions, options);

	// Add Publishing fields to the list
	list.add('Publishing', {
		publishing: {
			state: { label: 'Current State', type: String, default: 'draft', noedit: true },
			requestApproval: { label: 'Change State', type: Types.Select, options: 'none, draft, published, archived, deleted', default: 'draft', index: true },
			approvalPendingMessage: { label: 'Change Status', type: String, default: 'Pending Approval', dependsOn: { 'publishing.approvalPending':true},noedit:true },
			approvalPending: { label: 'Pending Approval', type: Boolean, hidden: true, default: false },
			approveRequest: { type: Boolean, hidden: true, default: false },
			schedulePublish: { label: 'Scheduled Publish', type: Boolean, default: false },
			publishDate: { label: 'Publish Date', type: Types.Datetime, index: true, dependsOn: { ['publishing.schedulePublish']: true } },
			scheduleUnpublish: { label: 'Scheduled Unpublish', type: Boolean, default: false },
			unpublishDate: { label: 'Unpublish Date', type: Types.Datetime, index: true, dependsOn: { ['publishing.scheduleUnpublish']: true } },
			unpublishState: { label: 'Unpublished State', type: Types.Select, options: 'archived, draft', default: 'archived', index: true, dependsOn: { ['publishing.scheduleUnpublish']: true } },
			debug: { type: String, noedit: true, hidden: true },
			publishedAt: { type: Types.Datetime, noedit: true, collapse: true },
			approvedAt: { type: Types.Datetime, noedit: true },
			approvedBy: { type: Types.Relationship, ref: 'User', index: true, noedit: true },
		} }

	);

	list.publishing = options;

	// Pre save check for state change requests
	list.schema.pre('save', function (next) {
		var debugMessage = 'selfApproval:' + options.selfApproval + ' | Pre Save: ';
		var now = new Date();
		var canUserApprove = false;
		this.set('publishing.debug', 'pre save');


        // Check if state change requires approval
		if (this.get('publishing.requestApproval') != this.get(options.stateField)) {
                debugMessage += 'Approval Pending: ' + this.get(options.stateField) + ' -> ' + this.get('publishing.requestApproval');
                this.set('publishing.approvalPending', true);

                // Does the user have permissions for this change?
                if (this.get('publishing.approveRequest')) {

                    // Must be author or editor to be able to change state
                    if (this._req_user.isAuthor || this._req_user.isEditor) {

                        // Own content can only be approved if selfApproval is enabled for this List
                        if (this._req_user._id == this.get('createdBy')) {
                            if (options.selfApproval) {
                                canUserApprove = true;
                            } else {
                                canUserApprove = false;
                            }
                        } else {
                            canUserApprove = true;
                        }

                // Everything looks good to approve this state change
                if (canUserApprove) {
                    this.set(options.stateField, this.get('publishing.requestApproval'));

                    this.set('publishing.approvedAt', now);
                    this.set('publishing.approvedBy', this._req_user._id);

                    // Reset Request
                    this.set('publishing.approveRequest', false);
					this.set('publishing.approvalPending', false);
					this.set('publishing.approvalPendingMessage', '');

                    debugMessage += 'Approved ' + this._req_user.email;
                } else {
                    throw new Error('Request to approve publishing change failed. \n'
                                        + 'The Publishing selfApproval option must be enabled. \n\n'
                                        + 'See http://keystonejs.com/docs/database/#lists-options for more information.');
                }

                } else {
                    throw new Error('Request to approve publishing change failed. \n'
                                    + 'User must have isEditor or isAuthor permissions enabled. \n\n'
                                    + 'See [http://keystonejs.com/docs/database/#lists-options] for more information.');

                }


                }


                        // Post save. Notify Editors and flash messages if we need approval

            } else {

                debugMessage += 'No Approval Pending';
                //this.set('publishing.approvalPending', false);
            }

		this.set('publishing.debug', debugMessage);
		next();

	});

};