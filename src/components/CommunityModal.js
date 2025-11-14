import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet, Text, View, Modal, TouchableOpacity, FlatList,
  Image, Alert, Dimensions, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../services/safeApiService';

const { width: screenWidth } = Dimensions.get('window');

export default function CommunityModal({ visible, onClose, currentUser }) {
  const [activeTab, setActiveTab] = useState('suggested'); // 'suggested' | 'following' | 'followers'
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [followersUsers, setFollowersUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Single source of truth for follow state across tabs
  const [followMap, setFollowMap] = useState({}); // { [userId]: true|false }
  const mounted = useRef(true);

  // derive counts from lists + map
  const followingCount = useMemo(
    () => followingUsers.length,
    [followingUsers.length]
  );
  const followersCount = useMemo(
    () => followersUsers.length,
    [followersUsers.length]
  );

  const setFollowed = useCallback((userId, isFollowed) => {
    setFollowMap(prev => ({ ...prev, [userId]: !!isFollowed }));
    // also reflect in following list contents
    if (isFollowed) {
      // if the user isn't already in following, optionally add a thin row (if API doesn't return immediately)
      const exists = followingUsers.some(u => u.id === userId);
      if (!exists) {
        const u = suggestedUsers.find(u => u.id === userId) || followersUsers.find(u => u.id === userId);
        if (u) setFollowingUsers(prev => [{ ...u }, ...prev]);
      }
    } else {
      setFollowingUsers(prev => prev.filter(u => u.id !== userId));
    }
  }, [followingUsers, suggestedUsers, followersUsers]);

  const loadTab = useCallback(async (tab) => {
    setLoading(true);
    try {
      await ApiService.ready; // ensure token is loaded from SecureStore first
      if (tab === 'suggested') {
        const res = await ApiService.get('/users/suggested');
        const data = res.data || [];
        if (!mounted.current) return;
        setSuggestedUsers(data);
        // prime followMap from server (if it returns is_following)
        setFollowMap(prev => {
          const next = { ...prev };
          data.forEach(u => { if (typeof u.is_following === 'boolean') next[u.id] = u.is_following; });
          return next;
        });
      } else if (tab === 'following') {
        const res = await ApiService.get('/users/following');
        const data = res.data || [];
        if (!mounted.current) return;
        setFollowingUsers(data);
        setFollowMap(prev => {
          const next = { ...prev };
          data.forEach(u => { next[u.id] = true; });
          return next;
        });
      } else if (tab === 'followers') {
        const res = await ApiService.get('/users/followers');
        const data = res.data || [];
        if (!mounted.current) return;
        setFollowersUsers(data);
        // note: followers isn't necessarily following; don't force map=true here
      }
    } catch (e) {
      if (mounted.current) {
        // Consider a non-blocking toast here
        Alert.alert('Error', 'Failed to load community data.');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // fetch current tab when modal opens or tab changes
  useEffect(() => {
    if (!visible) return;
    loadTab(activeTab);
  }, [visible, activeTab, loadTab]);

  // actions
  const handleFollowUser = useCallback(async (userId) => {
    // optimistic update
    setFollowed(userId, true);
    try {
      await ApiService.ready; // ensure token is loaded from SecureStore first
      await ApiService.post(`/users/${userId}/follow`);
    } catch (e) {
      // rollback
      setFollowed(userId, false);
      Alert.alert('Error', 'Failed to follow user.');
    }
  }, [setFollowed]);

  const handleUnfollowUser = useCallback(async (userId) => {
    // optimistic
    const previous = !!followMap[userId];
    setFollowed(userId, false);
    try {
      await ApiService.ready; // ensure token is loaded from SecureStore first
      await ApiService.delete(`/users/${userId}/follow`);
    } catch (e) {
      // rollback
      setFollowed(userId, previous);
      Alert.alert('Error', 'Failed to unfollow user.');
    }
  }, [followMap, setFollowed]);

  const handleDismissSuggested = useCallback((userId) => {
    setSuggestedUsers(prev => prev.filter(u => u.id !== userId));
    // Optional: await ApiService.post(`/users/suggested/${userId}/dismiss`)
  }, []);

  const handleSyncContacts = () => {
    Alert.alert(
      'Sync Contacts',
      'This feature would sync your contacts to find friends on the platform.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sync', onPress: () => console.log('Sync contacts') }
      ]
    );
  };

  const handleSyncFacebook = () => {
    Alert.alert(
      'Sync Facebook',
      'This feature would connect to Facebook to find friends.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sync', onPress: () => console.log('Sync Facebook') }
      ]
    );
  };

  const handleInviteFriends = () => {
    Alert.alert(
      'Invite Friends',
      'This feature would allow you to invite friends to join the platform.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Invites', onPress: () => console.log('Invite friends') }
      ]
    );
  };

  const SuggestedCard = ({ item }) => {
    const isFollowing = !!followMap[item.id];
    const displayName = item.display_name || item.username || 'User';
    return (
      <View style={styles.userCard}>
        <TouchableOpacity style={styles.closeButton} onPress={() => handleDismissSuggested(item.id)} accessibilityLabel="Dismiss suggestion">
          <Ionicons name="close" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <View style={styles.userContent}>
          <Text style={styles.suggestedLabel}>Suggested for you</Text>

          <View style={styles.userAvatar}>
            <Text style={styles.avatarText}>{(displayName[0] || 'U').toUpperCase()}</Text>
          </View>

          <Text style={styles.username}>{displayName}</Text>
          <Text style={styles.userHandle}>@{item.username || 'user'}</Text>

          {/* Sample tiles — consider real user previews from API */}
          <View style={styles.userItems}>
            {['👕','🧢','👔','👖'].map((emoji,i)=>(
              <View key={i} style={styles.itemImage}><Text style={{textAlign:'center'}}>{emoji}</Text></View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.followButton, isFollowing && { backgroundColor: '#E5E7EB' }]}
            onPress={() => isFollowing ? handleUnfollowUser(item.id) : handleFollowUser(item.id)}
            accessibilityRole="button"
          >
            <Text style={[styles.followButtonText, isFollowing && { color: '#6B7280' }]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const RowUser = ({ item, showFollowBack }) => {
    const isFollowing = !!followMap[item.id];
    const displayName = item.display_name || item.username || 'User';
    return (
      <View style={styles.followingUserItem}>
        <View style={styles.userInfo}>
          <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{(displayName[0] || 'U').toUpperCase()}</Text></View>
          <View style={styles.userDetails}>
            <Text style={styles.followingUsername}>{displayName}</Text>
            <Text style={styles.followingUserHandle}>@{item.username}</Text>
          </View>
        </View>

        {showFollowBack ? (
          !isFollowing && (
            <TouchableOpacity style={styles.followBackButton} onPress={() => handleFollowUser(item.id)}>
              <Text style={styles.followBackButtonText}>Follow Back</Text>
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity style={styles.unfollowButton} onPress={() => handleUnfollowUser(item.id)}>
            <Text style={styles.unfollowButtonText}>{isFollowing ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // lists
  const renderSuggested = () => (
    <FlatList
      data={suggestedUsers}
      keyExtractor={(u) => String(u.id)}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingLeft: 16, paddingVertical: 8 }}
      renderItem={({ item }) => <SuggestedCard item={item} />}
      ListEmptyComponent={!loading ? (
        <View style={{ padding: 16 }}><Text style={{ color: '#9CA3AF' }}>No suggestions right now</Text></View>
      ) : null}
      getItemLayout={(_, index) => ({ length: 212, offset: 212 * index, index })}
      initialNumToRender={6}
    />
  );

  const renderFollowing = () => (
    <FlatList
      data={followingUsers}
      keyExtractor={(u) => String(u.id)}
      contentContainerStyle={styles.followingList}
      renderItem={({ item }) => <RowUser item={item} />}
      ListEmptyComponent={!loading ? (
        <View style={styles.emptyState}><Text style={styles.emptyStateText}>You're not following anyone yet</Text></View>
      ) : null}
      initialNumToRender={12}
    />
  );

  const renderFollowers = () => (
    <FlatList
      data={followersUsers}
      keyExtractor={(u) => String(u.id)}
      contentContainerStyle={styles.followingList}
      renderItem={({ item }) => <RowUser item={item} showFollowBack />}
      ListEmptyComponent={!loading ? (
        <View style={styles.emptyState}><Text style={styles.emptyStateText}>No followers yet</Text></View>
      ) : null}
      initialNumToRender={12}
    />
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onClose?.()}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onClose?.()} style={styles.closeIcon} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My community</Text>
          <View style={styles.profileIcon}><Ionicons name="person-outline" size={24} color="#1F2937" /></View>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          {[
            { id: 'suggested', label: 'Suggested' },
            { id: 'following', label: `${followingCount} Following` },
            { id: 'followers', label: `${followersCount} Followers` },
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
              accessibilityRole="button"
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {loading && (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" color="#6B7280" />
            </View>
          )}
          {activeTab === 'suggested' && renderSuggested()}
          {activeTab === 'following' && renderFollowing()}
          {activeTab === 'followers' && renderFollowers()}

          {/* "Find people you know" can remain below suggested list */}
          {activeTab === 'suggested' && (
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}>
              <Text style={styles.findPeopleTitle}>Find people you know</Text>
              
              <TouchableOpacity style={styles.findPeopleItem} onPress={handleSyncContacts}>
                <View style={styles.findPeopleIcon}>
                  <Ionicons name="person-add" size={20} color="#6B7280" />
                </View>
                <View style={styles.findPeopleContent}>
                  <Text style={styles.findPeopleLabel}>Sync contacts</Text>
                  <Text style={styles.findPeopleDescription}>
                    Find friends who are already on the platform
                  </Text>
                </View>
                <Text style={styles.syncButton}>Sync</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.findPeopleItem} onPress={handleSyncFacebook}>
                <View style={[styles.findPeopleIcon, styles.facebookIcon]}>
                  <Ionicons name="logo-facebook" size={20} color="#1877F2" />
                </View>
                <View style={styles.findPeopleContent}>
                  <Text style={styles.findPeopleLabel}>Connect Facebook</Text>
                  <Text style={styles.findPeopleDescription}>
                    Find friends from your Facebook account
                  </Text>
                </View>
                <Text style={styles.syncButton}>Connect</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.findPeopleItem} onPress={handleInviteFriends}>
                <View style={styles.findPeopleIcon}>
                  <Ionicons name="mail" size={20} color="#6B7280" />
                </View>
                <View style={styles.findPeopleContent}>
                  <Text style={styles.findPeopleLabel}>Invite friends</Text>
                  <Text style={styles.findPeopleDescription}>
                    Send invitations to join the platform
                  </Text>
                </View>
                <Text style={styles.sendButton}>Send</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeIcon: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  profileIcon: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1F2937',
  },
  tabText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#1F2937',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  suggestedScroll: {
    paddingLeft: 16,
  },
  userCard: {
    width: 200,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginRight: 12,
    padding: 16,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  userContent: {
    alignItems: 'center',
  },
  suggestedLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  userItems: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  itemImage: {
    width: 30,
    height: 30,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  followButton: {
    backgroundColor: '#BFFF00',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  findPeopleSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  findPeopleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  findPeopleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  findPeopleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  facebookIcon: {
    backgroundColor: '#E3F2FD',
  },
  findPeopleContent: {
    flex: 1,
  },
  findPeopleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  findPeopleDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  syncButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  sendButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  followingList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  followingUserItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  smallAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  followingUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  followingUserHandle: {
    fontSize: 12,
    color: '#6B7280',
  },
  unfollowButton: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  unfollowButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  followBackButton: {
    backgroundColor: '#BFFF00',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  followBackButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});
