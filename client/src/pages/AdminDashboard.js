import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  BarChart3, 
 
  Users, 
  Calendar,
  Target,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Search,
  Edit3,
  Save,
  X,
  Download,
  UserCheck
} from 'lucide-react';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import AgentManagement from '../components/AgentManagement';
import LeadReassignModal from '../components/LeadReassignModal';
import Pagination from '../components/Pagination';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useRefresh } from '../contexts/RefreshContext';
import { scrollToTop } from '../utils/scrollUtils';
import { 
  formatEasternTimeForDisplay, 
  getEasternNow, 
  getEasternStartOfDay,
  getEasternEndOfDay,
  toEasternTime 
} from '../utils/dateUtils';
import { useDebounce, useDebouncedCallback } from '../hooks/useDebounce';

const AdminDashboard = () => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { registerRefreshCallback, unregisterRefreshCallback } = useRefresh();
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [allLeadsForStats, setAllLeadsForStats] = useState([]); // All leads for stats calculation
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(getEasternNow());
  const [showLeadsSection, setShowLeadsSection] = useState(false);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    pages: 0
  });

  // Search functionality
  const [searchResults, setSearchResults] = useState([]);

  // Edit modal states
  const [isEditing, setIsEditing] = useState(false);
  const [editedLead, setEditedLead] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Date filtering state - ONLY FOR ADMIN
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: '',
    filterType: 'all' // 'all', 'today', 'week', 'month', 'custom'
  });

  // Add qualification status filter
  const [qualificationFilter, setQualificationFilter] = useState('all'); // 'all', 'qualified', 'disqualified', 'pending'
  
  // Add duplicate status filter
  const [duplicateFilter, setDuplicateFilter] = useState('all'); // 'all', 'duplicates', 'non-duplicates'
  
  // Add organization filter
  const [organizationFilter, setOrganizationFilter] = useState('all'); // 'all' or specific organization ID
  const [organizations, setOrganizations] = useState([]); // List of all organizations
  
  // Lead update modal states - REMOVED (Admin is now read-only)
  const [selectedLead, setSelectedLead] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  
  // Lead reassignment modal states
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [leadToReassign, setLeadToReassign] = useState(null);
  
  const maskEmail = (email) => {
    if (!email) return '—';
    const [username, domain] = email.split('@');
    if (username.length <= 2) return `${username}***@${domain}`;
    return `${username.substring(0, 2)}***@${domain}`;
  };

  const maskPhone = (phone) => {
    if (!phone) return '—';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length <= 4) return '***-****';
    return `***-***-${cleaned.slice(-4)}`;
  };

  // Date filtering utility functions using Eastern Time
  const getDateFilteredLeads = (leadsToFilter) => {
    if (!dateFilter || dateFilter.filterType === 'all') {
      return leadsToFilter;
    }

    const now = getEasternNow();
    let startDate, endDate;

    switch (dateFilter.filterType) {
      case 'today':
        startDate = getEasternStartOfDay();
        endDate = getEasternEndOfDay();
        break;
      case 'week':
        startDate = now.clone().subtract(7, 'days').startOf('day');
        endDate = now.clone().endOf('day');
        break;
      case 'month':
        startDate = now.clone().subtract(1, 'month').startOf('day');
        endDate = now.clone().endOf('day');
        break;
      case 'custom':
        if (dateFilter.startDate) {
          startDate = getEasternStartOfDay(dateFilter.startDate);
        } else {
          startDate = now.clone().startOf('day');
        }
        if (dateFilter.endDate) {
          endDate = getEasternEndOfDay(dateFilter.endDate);
        } else {
          endDate = now.clone().endOf('day');
        }
        break;
      default:
        return leadsToFilter;
    }

    return leadsToFilter.filter(lead => {
      const leadDate = toEasternTime(lead.createdAt || lead.dateCreated);
      return leadDate.isBetween(startDate, endDate, null, '[]');
    });
  };

  const handleDateFilterChange = (filterType, startDate = '', endDate = '') => {
    setDateFilter({
      filterType,
      startDate,
      endDate
    });
    resetPaginationAndFetch();
  };







  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) {
      setRefreshing(true);
    }
    
    try {
      console.log('Admin Dashboard: Fetching stats...');
      const response = await axios.get('/api/leads/dashboard/stats');
      console.log('Stats response:', response.data);
      // Handle the nested response structure
      const statsData = response.data?.data || response.data;
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching stats:', error);
      if (!silent) {
        toast.error('Failed to fetch dashboard stats');
      }
    } finally {
      if (!silent) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, []);

  // Fetch all leads for stats calculation (handles large datasets up to lakhs)
  const fetchAllLeadsForStats = useCallback(async () => {
    try {
      console.log('Admin Dashboard: Fetching all leads for stats calculation...');
      const timestamp = new Date().getTime();
      let allLeads = [];
      let currentPage = 1;
      const limit = 1000; // Maximum allowed limit
      let hasMorePages = true;
      let totalRecords = 0;
      
      while (hasMorePages) {
        const url = `/api/leads?page=${currentPage}&limit=${limit}&_t=${timestamp}`;
        
        const response = await axios.get(url);
        const responseData = response.data?.data;
        const pageLeads = responseData?.leads || [];
        const pagination = responseData?.pagination;
        
        if (Array.isArray(pageLeads)) {
          allLeads = [...allLeads, ...pageLeads];
        }
        
        // Update total records count
        if (pagination) {
          totalRecords = pagination.total;
        }
        
        // Check if there are more pages
        if (pagination && currentPage < pagination.pages) {
          currentPage++;
          
          // Progress logging for large datasets
          if (currentPage % 10 === 0) {
            console.log(`Fetching page ${currentPage}/${pagination.pages} - ${allLeads.length}/${totalRecords} leads loaded`);
          }
        } else {
          hasMorePages = false;
        }
        
        // Safety check to prevent infinite loop - increased limit for lakhs of records
        if (currentPage > 1000) {
          console.warn('Safety break: More than 1000 pages (10 lakh records), stopping fetch');
          hasMorePages = false;
        }
      }
      
      console.log(`Successfully fetched ${allLeads.length} leads for stats calculation`);
      
      setAllLeadsForStats(allLeads);
      return allLeads;
    } catch (error) {
      console.error('Error fetching all leads for stats:', error);
      setAllLeadsForStats([]);
      return [];
    }
  }, []);

  const fetchLeads = useCallback(async (silent = false, page = pagination.page) => {
    try {
      console.log('Admin Dashboard: Fetching leads...');
      const timestamp = new Date().getTime();
      let url = `/api/leads?page=${page}&limit=${pagination.limit}&_t=${timestamp}`;
      
      // Add qualification filter if selected
      if (qualificationFilter && qualificationFilter !== 'all') {
        url += `&qualificationStatus=${qualificationFilter}`;
      }
      
      // Add duplicate filter if selected
      if (duplicateFilter && duplicateFilter !== 'all') {
        url += `&duplicateStatus=${duplicateFilter}`;
      }
      
      // Add organization filter if selected
      if (organizationFilter && organizationFilter !== 'all') {
        url += `&organization=${organizationFilter}`;
      }
      
      // Add date filtering parameters
      if (dateFilter.filterType && dateFilter.filterType !== 'all') {
        url += `&dateFilterType=${dateFilter.filterType}`;
        if (dateFilter.filterType === 'custom' && dateFilter.startDate && dateFilter.endDate) {
          url += `&startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`;
        }
      }
      
      const response = await axios.get(url);
      const responseData = response.data?.data;
      const leadsData = responseData?.leads;
      const paginationData = responseData?.pagination;
      
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      
      // Update pagination state if we have pagination data
      if (paginationData) {
        setPagination({
          page: paginationData.page,
          limit: paginationData.limit,
          total: paginationData.total,
          pages: paginationData.pages
        });
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
      if (!silent) {
        toast.error('Failed to fetch leads');
      }
      setLeads([]);
    }
  }, [pagination.page, pagination.limit, qualificationFilter, duplicateFilter, organizationFilter, dateFilter]);

  // Initial data fetching - separated to avoid circular dependencies
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Always fetch stats first to determine dataset size
        await fetchStats();
        await fetchOrganizations();
      } catch (error) {
        console.error('Error initializing dashboard:', error);
      }
    };

    initializeData();
  }, [fetchStats]); // Include fetchStats as dependency

  // Fetch all leads for stats when stats change
  useEffect(() => {
    if (stats && stats.totalLeads <= 10000) {
      fetchAllLeadsForStats();
    } else if (stats && stats.totalLeads > 10000) {
      console.log('Large dataset detected, skipping full leads fetch for performance');
      setAllLeadsForStats([]); // Clear the array for large datasets
    }
  }, [stats, fetchAllLeadsForStats]);

  // Fetch leads when filters change or when leads section is shown - ONLY for initial load
  useEffect(() => {
    if (showLeadsSection) {
      // Only fetch on initial load, not on filter changes (filters use debounced handlers)
      fetchLeads();
    }
  }, [showLeadsSection, fetchLeads]); // Removed filter dependencies to prevent race conditions

  // Handle refresh functionality
  const handleDashboardRefresh = useCallback(() => {
    // Scroll to top using utility function
    scrollToTop();
    
    // Reset filters and pagination
    setSearchInput('');
    setQualificationFilter('all');
    setDuplicateFilter('all');
    setOrganizationFilter('all');
    setDateFilter({
      startDate: '',
      endDate: '',
      filterType: 'all'
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    
    // Refetch data
    setRefreshing(true);
    const refreshData = async () => {
      try {
        await fetchStats();
        await fetchAllLeadsForStats();
        if (showLeadsSection) {
          await fetchLeads(false, 1);
        }
        setLastUpdated(getEasternNow());
      } catch (error) {
        console.error('Error refreshing dashboard:', error);
        toast.error('Failed to refresh dashboard');
      } finally {
        setRefreshing(false);
      }
    };
    refreshData();
  }, [fetchStats, fetchAllLeadsForStats, fetchLeads, showLeadsSection]);

  // Register refresh callback
  useEffect(() => {
    registerRefreshCallback('admin', handleDashboardRefresh);
    return () => {
      unregisterRefreshCallback('admin');
    };
  }, [registerRefreshCallback, unregisterRefreshCallback, handleDashboardRefresh]);

  // Pagination handler
  const handlePageChange = async (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: newPage }));
      await fetchLeads(false, newPage);
    }
  };

  // Reset pagination when filters change
  const resetPaginationAndFetch = useCallback(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchLeads(false, 1);
  }, [fetchLeads]);

  const fetchOrganizations = async () => {
    try {
      const response = await axios.get('/api/organizations');
      setOrganizations(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      setOrganizations([]);
    }
  };

  // Export leads function for AdminDashboard
  const handleExportLeads = async () => {
    try {
      const params = new URLSearchParams();
      
      // Add current filters as query parameters
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
      
      // Handle date filters based on type - send dateFilterType for backend processing
      if (dateFilter.filterType !== 'all') {
        params.append('dateFilterType', dateFilter.filterType);
        
        // For custom dates, also send start and end dates
        if (dateFilter.filterType === 'custom') {
          if (dateFilter.startDate) params.append('startDate', dateFilter.startDate);
          if (dateFilter.endDate) params.append('endDate', dateFilter.endDate);
        }
      }
      
      // Add qualification filter
      if (qualificationFilter !== 'all') {
        params.append('qualificationStatus', qualificationFilter);
      }
      
      // Add duplicate filter - match backend parameter name
      if (duplicateFilter !== 'all') {
        params.append('duplicateStatus', duplicateFilter);
      }
      
      // Add organization filter
      if (organizationFilter !== 'all') {
        params.append('organization', organizationFilter);
      }

      console.log('Export parameters:', params.toString());

      const response = await axios.get(`/api/leads/export?${params.toString()}`, {
        responseType: 'blob'
      });

      // Create blob and download
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      link.download = `leads-export-${dateStr}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Leads exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export leads');
    }
  };

  const openViewModal = (lead) => {
    setSelectedLead(lead);
    setEditedLead({ ...lead }); // Initialize edit state
    setIsEditing(false);
    setShowViewModal(true);
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setSelectedLead(null);
    setEditedLead(null);
    setIsEditing(false);
    setIsUpdating(false);
  };

  // Reassignment modal functions
  const openReassignModal = (lead) => {
    setLeadToReassign(lead);
    setShowReassignModal(true);
  };

  const closeReassignModal = () => {
    setShowReassignModal(false);
    setLeadToReassign(null);
  };

  const handleLeadReassigned = (updatedLead) => {
    // Update the lead in the leads array
    setLeads(prevLeads => 
      prevLeads.map(lead => 
        lead._id === updatedLead._id ? updatedLead : lead
      )
    );
    
    // Update search results if they exist
    setSearchResults(prevResults => 
      prevResults.map(lead => 
        lead._id === updatedLead._id ? updatedLead : lead
      )
    );
    
    // Close modal
    closeReassignModal();
  };

  // Check if user is from REDDINGTON GLOBAL CONSULTANCY
  const isReddingtonAdmin = useCallback(() => {
    console.log('User object:', user);
    console.log('User organization:', user?.organization);
    console.log('Organization name:', user?.organization?.name);
    console.log('Organization ID:', user?.organization);
    
    // Check by organization name first, then by ID as fallback
    const isReddingtonByName = user?.organization?.name === 'REDDINGTON GLOBAL CONSULTANCY';
    const isReddingtonById = user?.organization === '68b9c76d2c29dac1220cb81c' || user?.organization?._id === '68b9c76d2c29dac1220cb81c';
    
    const isReddington = isReddingtonByName || isReddingtonById;
    console.log('Is Reddington admin (by name):', isReddingtonByName);
    console.log('Is Reddington admin (by ID):', isReddingtonById);
    console.log('Final result:', isReddington);
    return isReddington;
  }, [user]);

  // Filter change handler with proper debouncing - moved before socket handlers
  const triggerFilteredFetch = useCallback(() => {
    if (showLeadsSection) {
      resetPaginationAndFetch();
    }
  }, [showLeadsSection, resetPaginationAndFetch]);

  // Socket.IO event listeners for real-time updates
  useEffect(() => {
    if (socket) {
      console.log('Admin Dashboard: Setting up socket listeners');
      
      const handleLeadUpdated = (data) => {
        console.log('Lead updated via socket:', data);
        // Only show notifications to main organization (REDDINGTON) admins
        if (isReddingtonAdmin()) {
          toast.success(`Lead updated by ${data.updatedBy}`, {
            duration: 2000,
            icon: '🔄'
          });
        }
        // Always refresh stats
        fetchStats(true);
        // Only refresh all leads for smaller datasets to avoid performance issues
        if (!stats || stats.totalLeads <= 10000) {
          fetchAllLeadsForStats();
        }
        // Use the debounced trigger to maintain current filters when refreshing leads
        if (showLeadsSection) {
          triggerFilteredFetch();
        }
        setLastUpdated(getEasternNow());
      };

      const handleLeadCreated = (data) => {
        console.log('New lead created via socket:', data);
        // Only show notifications to main organization (REDDINGTON) admins
        if (isReddingtonAdmin()) {
          toast.success(`New lead created by ${data.createdBy}`, {
            duration: 2000,
            icon: '✅'
          });
        }
        // Always refresh stats
        fetchStats(true);
        // Only refresh all leads for smaller datasets to avoid performance issues
        if (!stats || stats.totalLeads <= 10000) {
          fetchAllLeadsForStats();
        }
        // Use the debounced trigger to maintain current filters when refreshing leads
        if (showLeadsSection) {
          triggerFilteredFetch();
        }
        setLastUpdated(getEasternNow());
      };

      const handleLeadDeleted = (data) => {
        console.log('Lead deleted via socket:', data);
        // Only show notifications to main organization (REDDINGTON) admins
        if (isReddingtonAdmin()) {
          toast.success(`Lead deleted by ${data.deletedBy}`, {
            duration: 2000,
            icon: '🗑️'
          });
        }
        // Always refresh stats
        fetchStats(true);
        // Only refresh all leads for smaller datasets to avoid performance issues
        if (!stats || stats.totalLeads <= 10000) {
          fetchAllLeadsForStats();
        }
        // Use the debounced trigger to maintain current filters when refreshing leads
        if (showLeadsSection) {
          triggerFilteredFetch();
        }
        setLastUpdated(getEasternNow());
      };

      socket.on('leadUpdated', handleLeadUpdated);
      socket.on('leadCreated', handleLeadCreated);
      socket.on('leadDeleted', handleLeadDeleted);

      // Cleanup socket listeners
      return () => {
        socket.off('leadUpdated', handleLeadUpdated);
        socket.off('leadCreated', handleLeadCreated);
        socket.off('leadDeleted', handleLeadDeleted);
      };
    }
  }, [socket, showLeadsSection, fetchAllLeadsForStats, fetchStats, stats, isReddingtonAdmin, triggerFilteredFetch]);

  // Search functionality with debouncing
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearchTerm = useDebounce(searchInput, 300); // 300ms debounce

  const handleSearchFilter = useCallback((filteredLeads) => {
    if (!debouncedSearchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const searchLower = debouncedSearchTerm.toLowerCase();
    const filtered = filteredLeads.filter(lead => (
      lead.name?.toLowerCase().includes(searchLower) ||
      lead.phone?.includes(debouncedSearchTerm) ||
      lead.alternatePhone?.includes(debouncedSearchTerm) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead._id?.toLowerCase().includes(searchLower) ||
      lead.leadId?.toLowerCase().includes(searchLower)
    ));
    setSearchResults(filtered);
  }, [debouncedSearchTerm]);

  // Memoized filter computation to avoid recalculating on every render
  const memoizedFilteredLeads = useMemo(() => {
    let result = leads;
    
    // Apply qualification filter
    if (qualificationFilter !== 'all') {
      result = result.filter(lead => lead.qualificationStatus === qualificationFilter);
    }
    
    // Apply duplicate filter
    if (duplicateFilter !== 'all') {
      if (duplicateFilter === 'duplicates') {
        result = result.filter(lead => lead.isDuplicate === true);
      } else if (duplicateFilter === 'non-duplicates') {
        result = result.filter(lead => lead.isDuplicate !== true);
      }
    }
    
    // Apply organization filter
    if (organizationFilter !== 'all') {
      result = result.filter(lead => lead.organization?._id === organizationFilter || lead.organization === organizationFilter);
    }
    
    return result;
  }, [leads, qualificationFilter, duplicateFilter, organizationFilter]);

  // Debounce the filter trigger
  const debouncedTriggerFilteredFetch = useDebouncedCallback(triggerFilteredFetch, 500);

  const handleQualificationFilterChange = useCallback((newValue) => {
    setQualificationFilter(newValue);
    debouncedTriggerFilteredFetch();
  }, [debouncedTriggerFilteredFetch]);

  const handleDuplicateFilterChange = useCallback((newValue) => {
    setDuplicateFilter(newValue);
    debouncedTriggerFilteredFetch();
  }, [debouncedTriggerFilteredFetch]);

  const handleOrganizationFilterChange = useCallback((newValue) => {
    setOrganizationFilter(newValue);
    debouncedTriggerFilteredFetch();
  }, [debouncedTriggerFilteredFetch]);

  // Update search results when leads or search term changes
  useEffect(() => {
    handleSearchFilter(memoizedFilteredLeads);
  }, [memoizedFilteredLeads, handleSearchFilter, debouncedSearchTerm]);

  // Lead update functionality
  const handleEditToggle = () => {
    if (isEditing) {
      setEditedLead({ ...selectedLead }); // Reset changes
    }
    setIsEditing(!isEditing);
  };

  const handleCancelEdit = () => {
    setEditedLead({ ...selectedLead }); // Reset changes
    setIsEditing(false);
  };

  const handleInputChange = (field, value) => {
    setEditedLead(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Enhanced lead update with proper data types
  const handleLeadUpdate = async () => {
    if (!editedLead || !isReddingtonAdmin()) return;

    setIsUpdating(true);
    try {
      console.log('Frontend: Attempting to update lead with ID:', editedLead._id);
      console.log('Frontend: Original lead data:', selectedLead);
      console.log('Frontend: Edited lead data:', editedLead);
      
      // Prepare the update data with proper data types
      const updateData = {
        ...editedLead,
        totalDebtAmount: editedLead.totalDebtAmount ? parseInt(editedLead.totalDebtAmount) : undefined,
        numberOfCreditors: editedLead.numberOfCreditors ? parseInt(editedLead.numberOfCreditors) : undefined,
        monthlyDebtPayment: editedLead.monthlyDebtPayment ? parseInt(editedLead.monthlyDebtPayment) : undefined,
        conversionValue: editedLead.conversionValue ? parseInt(editedLead.conversionValue) : undefined,
        completionPercentage: editedLead.completionPercentage ? parseInt(editedLead.completionPercentage) : undefined,
      };

      console.log('Frontend: Sending update data:', updateData);
      console.log('Frontend: Making PUT request to:', `/api/leads/${editedLead._id}`);

      const response = await axios.put(`/api/leads/${editedLead._id}`, updateData);
      
      console.log('Frontend: Update response:', response.data);
      
      if (response.data) {
        // Update the lead in our local state
        setLeads(prevLeads => 
          prevLeads.map(lead => 
            lead._id === editedLead._id ? response.data.data.lead : lead
          )
        );
        
        // Update selected lead
        setSelectedLead(response.data.data.lead);
        setEditedLead(response.data.data.lead);
        setIsEditing(false);
        
        toast.success('Lead updated successfully');
        
        // Refresh stats and search results
        fetchStats(true);
        if (debouncedSearchTerm.trim()) {
          handleSearchFilter(memoizedFilteredLeads);
        }
      }
    } catch (error) {
      console.error('Frontend: Error updating lead:', error);
      console.error('Frontend: Error response:', error.response?.data);
      toast.error(error.response?.data?.message || 'Failed to update lead');
    } finally {
      setIsUpdating(false);
    }
  };

  // Lead progress status options
  const leadProgressOptions = [
    'Appointment Scheduled',
    'Immediate Enrollment', 
    'Info Provided – Awaiting Decision',
    'Nurture – Not Ready',
    'Qualified – Meets Criteria',
    'Pre-Qualified – Docs Needed',
    'Disqualified – Debt Too Low',
    'Disqualified – Secured Debt Only',
    'Disqualified – Non-Service State',
    'Disqualified – Active with Competitor',
    'Callback Needed',
    'Hung Up',
    'Not Interested',
    'DNC (Do Not Contact)'
  ];

  const getCategoryBadge = (category, completionPercentage = 0) => {
    const badges = {
      hot: 'bg-red-100 text-red-800 border-red-200',
      warm: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
      cold: 'bg-blue-100 text-blue-800 border-blue-200'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badges[category]}`}>
        {category.charAt(0).toUpperCase() + category.slice(1)} ({completionPercentage}%)
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const badges = {
      new: 'bg-gray-100 text-gray-800',
      interested: 'bg-green-100 text-green-800',
      'not-interested': 'bg-red-100 text-red-800',
      successful: 'bg-emerald-100 text-emerald-800',
      'follow-up': 'bg-blue-100 text-blue-800'
    };

    const icons = {
      new: AlertCircle,
      interested: CheckCircle,
      'not-interested': XCircle,
      successful: CheckCircle,
      'follow-up': Clock
    };

    const Icon = icons[status];

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[status]}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </span>
    );
  };

  const getQualificationBadge = (qualificationStatus) => {
    const badges = {
      qualified: 'bg-green-100 text-green-800 border-green-200',
      disqualified: 'bg-red-100 text-red-800 border-red-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };

    const icons = {
      qualified: CheckCircle,
      disqualified: XCircle,
      pending: Clock
    };

    const Icon = icons[qualificationStatus] || Clock;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badges[qualificationStatus] || badges.pending}`}>
        <Icon className="w-3 h-3 mr-1" />
        {qualificationStatus?.charAt(0).toUpperCase() + qualificationStatus?.slice(1) || 'Pending'}
      </span>
    );
  };

  const handleRefresh = () => {
    fetchStats(true);
  };

  // Calculate real-time stats from all leads data or use server stats for large datasets
  const calculateRealTimeStats = useCallback(() => {
    // For large datasets (>10,000 records), rely on server stats to avoid performance issues
    if (stats && stats.totalLeads > 10000) {
      console.log(`Large dataset detected (${stats.totalLeads} records), using server-calculated stats`);
      return {
        ...stats,
        pendingLeads: stats.pendingLeads || 0, // Ensure pending leads is included
        immediateEnrollmentLeads: stats.immediateEnrollmentLeads || 0
      };
    }

    // For smaller datasets, calculate from local data for real-time accuracy
    if (!allLeadsForStats || allLeadsForStats.length === 0) {
      return stats; // Return server stats if no all leads data
    }

    const totalLeads = allLeadsForStats.length;
    const qualifiedLeads = allLeadsForStats.filter(lead => lead.qualificationStatus === 'qualified').length;
    const disqualifiedLeads = allLeadsForStats.filter(lead => 
      lead.qualificationStatus === 'disqualified' || lead.qualificationStatus === 'unqualified'
    ).length;
    const pendingLeads = allLeadsForStats.filter(lead => lead.qualificationStatus === 'pending').length;
    const hotLeads = allLeadsForStats.filter(lead => lead.category === 'hot').length;
    
    // Calculate conversion rate based on LEAD PROGRESS STATUS 'Immediate Enrollment' divided by qualified leads
    // Formula: (No. of Immediate Enrollment leads (leadProgressStatus only) ÷ Qualified leads) × 100
    const immediateEnrollmentLeads = allLeadsForStats.filter(lead => 
      lead.leadProgressStatus === 'Immediate Enrollment'
    ).length;
    const calculatedConversionRate = qualifiedLeads > 0 ? parseFloat(((immediateEnrollmentLeads / qualifiedLeads) * 100).toFixed(2)) : 0;
    
    // Calculate qualification rate
    const totalProcessed = qualifiedLeads + disqualifiedLeads;
    const calculatedQualificationRate = totalProcessed > 0 ? (qualifiedLeads / totalProcessed) * 100 : 0;

    // Get unique active agents count
    const activeAgents = new Set();
    allLeadsForStats.forEach(lead => {
      if (lead.createdBy?.name) activeAgents.add(lead.createdBy.name);
      if (lead.assignedTo?.name) activeAgents.add(lead.assignedTo.name);
      if (lead.lastUpdatedBy) activeAgents.add(lead.lastUpdatedBy);
    });

    return {
      ...stats, // Keep server stats as fallback
      totalLeads,
      qualifiedLeads,
      disqualifiedLeads,
      pendingLeads,
      hotLeads,
      conversionRate: calculatedConversionRate,
      qualificationRate: calculatedQualificationRate,
      activeAgents: activeAgents.size,
      immediateEnrollmentLeads // Add this for reference
    };
  }, [allLeadsForStats, stats]);

  if (loading) {
    return <LoadingSpinner message="Loading admin dashboard..." />;
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Unable to load dashboard data</p>
        <button 
          onClick={() => fetchStats()}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Get real-time stats
  const realTimeStats = calculateRealTimeStats();
  const qualificationRate = parseFloat(realTimeStats.qualificationRate) || 0;
  const conversionRate = parseFloat(realTimeStats.conversionRate) || 0;

  // Apply search filter first, then date filter (only if no backend date filtering)
  const baseLeads = debouncedSearchTerm.trim() ? searchResults : leads;
  
  // If date filter is applied on backend, don't apply client-side date filtering
  const shouldApplyClientDateFilter = !dateFilter.filterType || dateFilter.filterType === 'all';
  const filteredLeads = shouldApplyClientDateFilter ? getDateFilteredLeads(baseLeads) : baseLeads;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-10 px-2">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Real-time lead management overview <span className="font-semibold text-blue-600">(Read-only access)</span></p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Last updated: <span className="font-semibold">{formatEasternTimeForDisplay(lastUpdated, { includeTimezone: true })}</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:scale-105 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all duration-200"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-8">
          <div className="bg-white p-7 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-4">
            <div className="p-4 rounded-full bg-blue-100">
              <BarChart3 className="h-7 w-7 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Leads</p>
              <p className="text-3xl font-bold text-gray-900">{realTimeStats.totalLeads}</p>
            </div>
          </div>

          {/* <div className="bg-white p-7 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-4">
            <div className="p-4 rounded-full bg-green-100">
              <TrendingUp className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Hot Leads</p>
              <p className="text-3xl font-bold text-gray-900">{stats.hotLeads}</p>
            </div>
          </div> */}

          <div className="bg-white p-7 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-4">
            <div className="p-4 rounded-full bg-emerald-100">
              <CheckCircle className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Qualified</p>
              <p className="text-3xl font-bold text-gray-900">{realTimeStats.qualifiedLeads || 0}</p>
              <p className="text-xs text-emerald-600 font-medium">{qualificationRate.toFixed(1)}%</p>
            </div>
          </div>

          <div className="bg-white p-7 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-4">
            <div className="p-4 rounded-full bg-red-100">
              <XCircle className="h-7 w-7 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Disqualified</p>
              <p className="text-3xl font-bold text-gray-900">{realTimeStats.disqualifiedLeads || 0}</p>
            </div>
          </div>

          <div className="bg-white p-7 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-4">
            <div className="p-4 rounded-full bg-orange-100">
              <Clock className="h-7 w-7 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-3xl font-bold text-gray-900">{realTimeStats.pendingLeads || 0}</p>
            </div>
          </div>

          <div className="bg-white p-7 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-4">
            <div className="p-4 rounded-full bg-yellow-100">
              <Target className="h-7 w-7 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
              <p className="text-3xl font-bold text-gray-900">{conversionRate.toFixed(2)}%</p>
              <p className="text-xs text-gray-500">
                Qualified / Immediate Enrollment ({realTimeStats.immediateEnrollmentLeads || 0})
              </p>
            </div>
          </div>

          <div className="bg-white p-7 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-4">
            <div className="p-4 rounded-full bg-purple-100">
              <Users className="h-7 w-7 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Active Agents</p>
              <p className="text-3xl font-bold text-gray-900">{realTimeStats.activeAgents || 0}</p>
            </div>
          </div>
        </div>

        {/* Lead Management Toggle */}
        <div className="bg-white p-7 rounded-2xl shadow-xl border border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Lead Management</h3>
            <p className="text-sm text-gray-600">View all leads and observe agent actions <span className="font-semibold text-blue-600">(Admin has read-only access)</span></p>
          </div>
          <button
            onClick={() => setShowLeadsSection(!showLeadsSection)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:scale-105 transition-all duration-200"
          >
            {showLeadsSection ? 'Hide Leads' : 'Show Leads'}
          </button>
        </div>

        {/* Search Bar - Only for REDDINGTON GLOBAL CONSULTANCY admins */}
        {showLeadsSection && (
          <div className="bg-yellow-100 p-2 rounded-lg text-sm text-gray-800 mb-4">
            {/* Debug: User={user?.name}, Org={user?.organization?.name}, IsReddington={isReddingtonAdmin()} */}
          </div>
        )}
        {showLeadsSection && (
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-gray-400" />
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search leads by name, phone, email, or lead ID..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                />
              </div>
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setSearchResults([]);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {debouncedSearchTerm && (
              <p className="text-sm text-gray-600 mt-2">
                Found {searchResults.length} lead{searchResults.length !== 1 ? 's' : ''} matching "{debouncedSearchTerm}"
              </p>
            )}
          </div>
        )}

      {/* Compact Filter Controls - ONLY FOR ADMIN */}
      {showLeadsSection && (
        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 space-y-3">
          {/* Date Filter Row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Date:</span>
            </div>
            
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => handleDateFilterChange('all')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  dateFilter.filterType === 'all' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleDateFilterChange('today')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  dateFilter.filterType === 'today' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => handleDateFilterChange('week')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  dateFilter.filterType === 'week' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => handleDateFilterChange('month')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  dateFilter.filterType === 'month' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                30 Days
              </button>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-gray-600">Custom:</span>
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => handleDateFilterChange('custom', e.target.value, dateFilter.endDate)}
                className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              />
              <span className="text-xs text-gray-500">to</span>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => handleDateFilterChange('custom', dateFilter.startDate, e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Other Filters Row */}
          <div className="flex flex-wrap items-center gap-6">
            {/* Qualification Filter */}
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Qualification:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => handleQualificationFilterChange('all')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    qualificationFilter === 'all' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => handleQualificationFilterChange('qualified')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    qualificationFilter === 'qualified' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Qualified
                </button>
                <button
                  onClick={() => handleQualificationFilterChange('disqualified')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    qualificationFilter === 'disqualified' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Disqualified
                </button>
                <button
                  onClick={() => handleQualificationFilterChange('pending')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    qualificationFilter === 'pending' 
                      ? 'bg-yellow-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Pending
                </button>
              </div>
            </div>
            
            {/* Duplicate Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Duplicates:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => handleDuplicateFilterChange('all')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    duplicateFilter === 'all' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => handleDuplicateFilterChange('duplicates')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    duplicateFilter === 'duplicates' 
                      ? 'bg-yellow-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Dups Only
                </button>
                <button
                  onClick={() => handleDuplicateFilterChange('non-duplicates')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    duplicateFilter === 'non-duplicates' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Original Only
                </button>
              </div>
            </div>
            
            {/* Organization Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Org:</span>
              <div className="flex gap-1 max-w-md overflow-x-auto">
                <button
                  onClick={() => handleOrganizationFilterChange('all')}
                  className={`px-2 py-1 text-xs rounded whitespace-nowrap transition-colors ${
                    organizationFilter === 'all' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {organizations.slice(0, 3).map((org) => (
                  <button
                    key={org._id}
                    onClick={() => handleOrganizationFilterChange(org._id)}
                    className={`px-2 py-1 text-xs rounded whitespace-nowrap transition-colors ${
                      organizationFilter === org._id 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={org.name}
                  >
                    {org.name.length > 12 ? org.name.substring(0, 12) + '...' : org.name}
                  </button>
                ))}
                {organizations.length > 3 && (
                  <select
                    value={organizationFilter}
                    onChange={(e) => handleOrganizationFilterChange(e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="all">All Orgs</option>
                    {organizations.map((org) => (
                      <option key={org._id} value={org._id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            
            {/* Export Button - Only for Reddington Admin */}
            {isReddingtonAdmin() && (
              <div className="flex items-center">
                <button
                  onClick={handleExportLeads}
                  className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          </div>
          
          {/* Filter Summary */}
          <div className="text-xs text-gray-600 border-t border-gray-100 pt-2">
            Showing {filteredLeads.length} of {pagination.total || leads.length} leads
            {qualificationFilter !== 'all' && (
              <span className="ml-2 text-primary-600 font-medium">
                • {qualificationFilter.charAt(0).toUpperCase() + qualificationFilter.slice(1)}
              </span>
            )}
            {duplicateFilter !== 'all' && (
              <span className="ml-2 text-yellow-600 font-medium">
                • {duplicateFilter === 'duplicates' ? 'Duplicates Only' : 'Original Only'}
              </span>
            )}
            {organizationFilter !== 'all' && (
              <span className="ml-2 text-blue-600 font-medium">
                • {organizations.find(org => org._id === organizationFilter)?.name || 'Unknown'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Leads Section */}
      {showLeadsSection && (
        <div className="space-y-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">All Leads</h3>
              <p className="text-sm text-gray-600">Comprehensive view of all leads from Agent1 and Agent2</p>
            </div>
            
            {/* Compact Card-Based Layout */}
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {filteredLeads.map((lead) => (
                <div key={lead.leadId || lead._id} className="bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow duration-200">
                  <div className="p-3">
                    <div className="grid grid-cols-12 gap-3 items-center">
                      {/* Lead Basic Info - 3 columns */}
                      <div className="col-span-3">
                        <div className="flex items-center space-x-2">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold text-xs">
                                {lead.name ? lead.name.charAt(0).toUpperCase() : 'L'}
                              </span>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">{lead.name}</p>
                            {lead.leadId && (
                              <span className="text-xs text-primary-600 font-mono bg-primary-50 px-1 py-0.5 rounded">
                                {lead.leadId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contact Info - 2 columns */}
                      <div className="col-span-2">
                        <div className="text-xs space-y-0.5">
                          <div className="text-gray-600 truncate">{maskEmail(lead.email)}</div>
                          <div className="text-gray-500">{maskPhone(lead.phone)}</div>
                        </div>
                      </div>

                      {/* Organization - 1 column */}
                      <div className="col-span-1">
                        <div className="text-xs">
                          <span className="text-gray-900 font-medium truncate block" title={lead.organization?.name || 'Unknown'}>
                            {lead.organization?.name ? 
                              (lead.organization.name.length > 10 ? lead.organization.name.substring(0, 10) + '...' : lead.organization.name) 
                              : 'Unknown'}
                          </span>
                        </div>
                      </div>

                      {/* Created Date - 1.5 columns */}
                      <div className="col-span-1">
                        <div className="text-xs">
                          <div className="text-gray-900 font-medium">
                            {formatEasternTimeForDisplay(lead.createdAt, { includeTime: false })}
                          </div>
                          <div className="text-gray-500">
                            {formatEasternTimeForDisplay(lead.createdAt, { includeTime: true, timeOnly: true })}
                          </div>
                        </div>
                      </div>

                      {/* Category - 1 column */}
                      <div className="col-span-1">
                        <div className="flex flex-col items-start">
                          {getCategoryBadge(lead.category, lead.completionPercentage)}
                        </div>
                      </div>

                      {/* Status Indicators - 2 columns */}
                      <div className="col-span-2">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center">
                            {getQualificationBadge(lead.qualificationStatus)}
                          </div>
                          <div className="flex items-center">
                            {lead.isDuplicate ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                ⚠️ Dup
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                ✓ Orig
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Agent Status - 1.5 columns */}
                      <div className="col-span-2">
                        <div className="text-xs">
                          {lead.leadProgressStatus ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800 truncate max-w-full" title={lead.leadProgressStatus}>
                              {lead.leadProgressStatus.length > 15 ? lead.leadProgressStatus.substring(0, 15) + '...' : lead.leadProgressStatus}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">No status</span>
                          )}
                          {isReddingtonAdmin() && lead.lastUpdatedBy && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              by {lead.lastUpdatedBy}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions - 1 column */}
                      <div className="col-span-1">
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => openViewModal(lead)}
                            className="w-full text-primary-600 hover:text-primary-900 bg-primary-50 hover:bg-primary-100 px-2 py-1 rounded text-xs transition-colors duration-200 flex items-center justify-center gap-1"
                          >
                            {isReddingtonAdmin() ? (
                              <>
                                <Edit3 className="h-3 w-3" />
                                Edit
                              </>
                            ) : (
                              'View'
                            )}
                          </button>
                          
                          {/* Reassign button - Only for REDDINGTON GLOBAL CONSULTANCY admins */}
                          {isReddingtonAdmin() && (
                            <button
                              onClick={() => openReassignModal(lead)}
                              className="w-full text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded text-xs transition-colors duration-200 flex items-center justify-center gap-1"
                              title="Reassign lead to Agent 2"
                            >
                              <UserCheck className="h-3 w-3" />
                              Reassign
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Additional Info Row - Collapsible */}
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="grid grid-cols-12 gap-3 text-xs text-gray-500">
                        <div className="col-span-3">
                          <span>Created: {lead.createdBy?.name || 'Unknown'}</span>
                        </div>
                        <div className="col-span-3">
                          <span className="text-blue-600">Created: {formatEasternTimeForDisplay(lead.createdAt, { includeTime: false })}</span>
                        </div>
                        {isReddingtonAdmin() && lead.lastUpdatedBy && (
                          <div className="col-span-3">
                            <span className="text-green-600">Updated: {lead.lastUpdatedBy}</span>
                          </div>
                        )}
                        <div className="col-span-3 text-right">
                          {lead.lastUpdatedAt && (
                            <span>
                              {formatEasternTimeForDisplay(lead.lastUpdatedAt, { includeTime: false })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredLeads.length === 0 && (
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
                  <div className="text-gray-500">
                    <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-lg font-medium text-gray-900 mb-2">No leads found</p>
                    <p className="text-gray-500">No leads match your current filter criteria.</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Pagination */}
            {pagination.total > 0 && (
              <div className="mt-6 px-6 pb-6">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.pages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  onPageChange={handlePageChange}
                  className="border-t border-gray-200 pt-4"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Lead Details Modal */}
      {showViewModal && selectedLead && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div 
                className="absolute inset-0 bg-gray-500 opacity-75"
                onClick={closeViewModal}
              ></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {isReddingtonAdmin() && isEditing ? 'Edit Lead' : 'Lead Details'}: {selectedLead.name}
                    </h3>
                    <p className="text-blue-100 text-sm">
                      {isReddingtonAdmin() && isEditing ? 'Modify lead information and status' : 'Complete lead information and tracking'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isReddingtonAdmin() && (
                      <>
                        {isEditing ? (
                          <>
                            <button
                              onClick={handleLeadUpdate}
                              disabled={isUpdating}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Save className="h-4 w-4" />
                              {isUpdating ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            >
                              <X className="h-4 w-4" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={handleEditToggle}
                            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                          >
                            <Edit3 className="h-4 w-4" />
                            Edit
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={closeViewModal}
                      className="text-white hover:text-blue-200 transition-colors"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white px-6 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Personal Information */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-5 rounded-xl border border-gray-200">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-blue-100 rounded-lg mr-3">
                        <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-800">Personal Information</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Name:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="text"
                            value={editedLead.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="text-sm text-gray-900 font-medium text-right border border-gray-300 rounded px-2 py-1 w-32"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 font-medium text-right">{selectedLead.name || '—'}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Email:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="email"
                            value={editedLead.email || ''}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className="text-sm text-gray-900 text-right border border-gray-300 rounded px-2 py-1 w-40"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right break-all">{selectedLead.email || '—'}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Phone:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="tel"
                            value={editedLead.phone || ''}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            className="text-sm text-gray-900 text-right border border-gray-300 rounded px-2 py-1 w-32"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right">{selectedLead.phone || '—'}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Alt. Phone:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="tel"
                            value={editedLead.alternatePhone || ''}
                            onChange={(e) => handleInputChange('alternatePhone', e.target.value)}
                            className="text-sm text-gray-900 text-right border border-gray-300 rounded px-2 py-1 w-32"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right">{selectedLead.alternatePhone || '—'}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Address Information */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl border border-green-200">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-green-100 rounded-lg mr-3">
                        <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-800">Address Information</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Address:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <textarea
                            value={editedLead.address || ''}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                            className="text-sm text-gray-900 text-right border border-gray-300 rounded px-2 py-1 w-40 h-16 resize-none"
                            placeholder="Enter address"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right max-w-xs">{selectedLead.address || '—'}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">City:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="text"
                            value={editedLead.city || ''}
                            onChange={(e) => handleInputChange('city', e.target.value)}
                            className="text-sm text-gray-900 text-right border border-gray-300 rounded px-2 py-1 w-32"
                            placeholder="Enter city"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right">{selectedLead.city || '—'}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">State:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="text"
                            value={editedLead.state || ''}
                            onChange={(e) => handleInputChange('state', e.target.value)}
                            className="text-sm text-gray-900 text-right border border-gray-300 rounded px-2 py-1 w-24"
                            placeholder="Enter state"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right">{selectedLead.state || '—'}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Zipcode:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="text"
                            value={editedLead.zipcode || ''}
                            onChange={(e) => handleInputChange('zipcode', e.target.value)}
                            className="text-sm text-gray-900 text-right border border-gray-300 rounded px-2 py-1 w-24"
                            placeholder="Enter zipcode"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right">{selectedLead.zipcode || '—'}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Debt Information */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-xl border border-purple-200">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-purple-100 rounded-lg mr-3">
                        <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-800">Debt Information</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Category:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <select
                            value={editedLead.debtCategory || editedLead.category || ''}
                            onChange={(e) => handleInputChange('debtCategory', e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1 w-24"
                          >
                            <option value="">Select</option>
                            <option value="hot">Hot</option>
                            <option value="warm">Warm</option>
                            <option value="cold">Cold</option>
                          </select>
                        ) : (
                          <span className="text-sm text-gray-900 text-right capitalize">{selectedLead.debtCategory || selectedLead.category || '—'}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Source:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="text"
                            value={editedLead.source || ''}
                            onChange={(e) => handleInputChange('source', e.target.value)}
                            className="text-sm text-gray-900 text-right border border-gray-300 rounded px-2 py-1 w-32"
                            placeholder="Lead source"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right">{selectedLead.source || '—'}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Total Amount:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="number"
                            value={editedLead.totalDebtAmount || ''}
                            onChange={(e) => handleInputChange('totalDebtAmount', parseInt(e.target.value) || 0)}
                            className="text-sm text-gray-900 text-right border border-gray-300 rounded px-2 py-1 w-32"
                            placeholder="0"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right font-semibold">
                            {selectedLead.totalDebtAmount ? `$${selectedLead.totalDebtAmount.toLocaleString()}` : '—'}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Creditors:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="number"
                            value={editedLead.numberOfCreditors || ''}
                            onChange={(e) => handleInputChange('numberOfCreditors', parseInt(e.target.value) || 0)}
                            className="text-sm text-gray-900 text-right border border-gray-300 rounded px-2 py-1 w-20"
                            placeholder="0"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right">{selectedLead.numberOfCreditors || '—'}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Monthly Payment:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="number"
                            value={editedLead.monthlyDebtPayment || ''}
                            onChange={(e) => handleInputChange('monthlyDebtPayment', parseInt(e.target.value) || 0)}
                            className="text-sm text-gray-900 text-right border border-gray-300 rounded px-2 py-1 w-32"
                            placeholder="0"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right">
                            {selectedLead.monthlyDebtPayment ? `$${selectedLead.monthlyDebtPayment.toLocaleString()}` : '—'}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Credit Score:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <select
                            value={editedLead.creditScoreRange || ''}
                            onChange={(e) => handleInputChange('creditScoreRange', e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1 w-32"
                          >
                            <option value="">Select Range</option>
                            <option value="Poor (300-579)">Poor (300-579)</option>
                            <option value="Fair (580-669)">Fair (580-669)</option>
                            <option value="Good (670-739)">Good (670-739)</option>
                            <option value="Very Good (740-799)">Very Good (740-799)</option>
                            <option value="Excellent (800-850)">Excellent (800-850)</option>
                          </select>
                        ) : (
                          <span className="text-sm text-gray-900 text-right">{selectedLead.creditScoreRange || '—'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Management & Status Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  {/* Management Information */}
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-5 rounded-xl border border-orange-200">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-orange-100 rounded-lg mr-3">
                        <svg className="h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-800">Management Info</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Created By:</span>
                        <span className="text-sm text-gray-900 text-right font-medium">{selectedLead.createdBy?.name || '—'}</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Created At:</span>
                        <span className="text-sm text-gray-900 text-right">
                          {selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Category:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <select
                            value={editedLead.category || ''}
                            onChange={(e) => handleInputChange('category', e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1 w-24"
                          >
                            <option value="">Select</option>
                            <option value="hot">Hot</option>
                            <option value="warm">Warm</option>
                            <option value="cold">Cold</option>
                          </select>
                        ) : (
                          <div className="text-right">{getCategoryBadge(selectedLead.category, selectedLead.completionPercentage)}</div>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Qualification:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <div className="text-right">
                            <select
                              value={editedLead.qualificationStatus || ''}
                              onChange={(e) => handleInputChange('qualificationStatus', e.target.value)}
                              className="text-sm border border-gray-300 rounded px-2 py-1 w-32"
                            >
                              <option value="">Select Status</option>
                              <option value="qualified">Qualified</option>
                              <option value="disqualified">Disqualified</option>
                              <option value="pending">Pending</option>
                            </select>
                            <div className="text-xs text-blue-600 italic mt-1">Independent from Lead Progress</div>
                          </div>
                        ) : (
                          <div className="text-right">{getQualificationBadge(selectedLead.qualificationStatus)}</div>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Status:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <select
                            value={editedLead.status || ''}
                            onChange={(e) => handleInputChange('status', e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1 w-32"
                          >
                            {/* <option value="">Select Status</option>
                            <option value="new">New</option>
                            <option value="interested">Interested</option>
                            <option value="not-interested">Not Interested</option>
                            <option value="successful">Successful</option>
                            <option value="follow-up">Follow-up</option> */}
                          </select>
                        ) : (
                          <div className="text-right">{getStatusBadge(selectedLead.status)}</div>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        {/* <span className="text-sm font-medium text-gray-600">Company:</span> */}
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="text"
                            value={editedLead.company || ''}
                            onChange={(e) => handleInputChange('company', e.target.value)}
                            className="text-sm text-gray-900 text-right border border-gray-300 rounded px-2 py-1 w-32"
                            placeholder="Company name"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right">{selectedLead.company || ''}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        {/* <span className="text-sm font-medium text-gray-600">Completion %:</span> */}
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            // type="number"
                            // min="0"
                            // max="100"
                            // value={editedLead.completionPercentage || ''}
                            // onChange={(e) => handleInputChange('completionPercentage', parseInt(e.target.value) || 0)}
                            // className="text-sm text-gray-900 text-right border border-gray-300 rounded px-2 py-1 w-20"
                            // placeholder=""
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right"></span>
                        )}
                      </div>
                      {isReddingtonAdmin() && selectedLead.lastUpdatedBy && (
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-medium text-gray-600">Updated By:</span>
                          <span className="text-sm text-green-700 text-right font-medium">{selectedLead.lastUpdatedBy}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Agent2 Status Tracking */}
                  <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-5 rounded-xl border border-teal-200">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-teal-100 rounded-lg mr-3">
                        <svg className="h-5 w-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-800">Agent2 Actions & Status</h4>
                      {isReddingtonAdmin() && isEditing && (
                        <p className="text-xs text-blue-600 italic">Note: Lead Progress Status and Qualification Status are independent fields</p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded-lg border border-teal-200">
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-medium text-gray-600">Lead Progress Status:</span>
                          {isReddingtonAdmin() && isEditing ? (
                            <select
                              value={editedLead.leadProgressStatus || ''}
                              onChange={(e) => handleInputChange('leadProgressStatus', e.target.value)}
                              className="text-sm border border-gray-300 rounded px-2 py-1 w-48"
                            >
                              <option value="">Select Status</option>
                              {leadProgressOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            selectedLead.leadProgressStatus ? (
                              <span className="text-sm bg-teal-100 text-teal-800 px-2 py-1 rounded-full font-medium text-right max-w-xs">
                                {selectedLead.leadProgressStatus}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500 italic">No status update yet</span>
                            )
                          )}
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Follow-up Date:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="date"
                            value={editedLead.followUpDate ? new Date(editedLead.followUpDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => handleInputChange('followUpDate', e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right">
                            {selectedLead.followUpDate ? new Date(selectedLead.followUpDate).toLocaleDateString() : '—'}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Follow-up Time:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="time"
                            value={editedLead.followUpTime || ''}
                            onChange={(e) => handleInputChange('followUpTime', e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 text-right">
                            {selectedLead.followUpTime || '—'}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-600">Conversion Value:</span>
                        {isReddingtonAdmin() && isEditing ? (
                          <input
                            type="number"
                            value={editedLead.conversionValue || ''}
                            onChange={(e) => handleInputChange('conversionValue', parseInt(e.target.value) || 0)}
                            className="text-sm border border-gray-300 rounded px-2 py-1 w-32"
                            placeholder="0"
                          />
                        ) : (
                          <span className="text-sm text-green-600 text-right font-semibold">
                            {selectedLead.conversionValue ? `$${selectedLead.conversionValue.toLocaleString()}` : '—'}
                          </span>
                        )}
                      </div>
                      
                      {isReddingtonAdmin() && selectedLead.lastUpdatedBy && (
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-medium text-gray-600">Last Updated By:</span>
                          <span className="text-sm text-teal-700 text-right font-medium">{selectedLead.lastUpdatedBy}</span>
                        </div>
                      )}
                      
                      {selectedLead.lastUpdatedAt && (
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-medium text-gray-600">Last Updated At:</span>
                          <span className="text-sm text-gray-900 text-right">
                            {formatEasternTimeForDisplay(selectedLead.lastUpdatedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes & Comments Section */}
                <div className="mt-6">
                  <div className="bg-gradient-to-r from-gray-100 to-gray-200 p-4 rounded-xl">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Notes & Comments
                    </h4>
                    
                    <div className="space-y-4">
                      {/* Agent1 Notes */}
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center mb-2">
                          <span className="text-sm font-semibold text-blue-800">Agent1 Notes:</span>
                        </div>
                        {isReddingtonAdmin() && isEditing ? (
                          <textarea
                            value={editedLead.notes || ''}
                            onChange={(e) => handleInputChange('notes', e.target.value)}
                            className="w-full text-sm text-gray-900 border border-blue-300 rounded px-3 py-2 h-20 resize-none"
                            placeholder="Enter Agent1 notes..."
                          />
                        ) : (
                          <p className="text-sm text-gray-900 leading-relaxed">{selectedLead.notes || 'No notes available'}</p>
                        )}
                      </div>
                      
                      {/* Assignment Notes */}
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="flex items-center mb-2">
                          <span className="text-sm font-semibold text-purple-800">Assignment Notes:</span>
                        </div>
                        {isReddingtonAdmin() && isEditing ? (
                          <textarea
                            value={editedLead.assignmentNotes || ''}
                            onChange={(e) => handleInputChange('assignmentNotes', e.target.value)}
                            className="w-full text-sm text-gray-900 border border-purple-300 rounded px-3 py-2 h-20 resize-none"
                            placeholder="Enter assignment notes..."
                          />
                        ) : (
                          <p className="text-sm text-gray-900 leading-relaxed">{selectedLead.assignmentNotes || 'No assignment notes available'}</p>
                        )}
                      </div>
                      
                      {/* Agent2 Follow-up Notes */}
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center mb-2">
                          <span className="text-sm font-semibold text-green-800">Agent2 Follow-up Notes:</span>
                        </div>
                        {isReddingtonAdmin() && isEditing ? (
                          <textarea
                            value={editedLead.followUpNotes || ''}
                            onChange={(e) => handleInputChange('followUpNotes', e.target.value)}
                            className="w-full text-sm text-gray-900 border border-green-300 rounded px-3 py-2 h-20 resize-none"
                            placeholder="Enter follow-up notes..."
                          />
                        ) : (
                          <p className="text-sm text-gray-900 leading-relaxed">{selectedLead.followUpNotes || 'No follow-up notes available'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-3 flex justify-end">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Reassignment Modal */}
      <LeadReassignModal
        isOpen={showReassignModal}
        onClose={closeReassignModal}
        lead={leadToReassign}
        onLeadReassigned={handleLeadReassigned}
      />

      {/* Agent Management Section */}
      <AgentManagement />
      </div>
    </div>
  );
};

export default AdminDashboard;
